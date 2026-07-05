#!/usr/bin/env node
/**
 * Integration test for Supabase auth API.
 * Usage: node scripts/test-auth.mjs [baseUrl]
 * Requires .env.local with Supabase keys and dev server running.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const envPath = resolve(process.cwd(), ".env.local");

function loadEnv() {
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx);
      const value = trimmed.slice(idx + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.error("Missing .env.local — copy from .env.local.example and fill Supabase keys.");
    process.exit(1);
  }
}

async function request(path, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });

  const setCookie = response.headers.getSetCookie?.() ?? [];
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }

  return { status: response.status, json, setCookie };
}

async function main() {
  loadEnv();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required in .env.local");
    process.exit(1);
  }

  const stamp = Date.now();
  const email = `test-${stamp}@example.com`;
  const password = "test-password-123";

  console.log(`Testing auth against ${baseUrl}`);
  console.log(`Test user: ${email}`);

  const health = await request("/api/auth/login", { method: "GET" });
  console.log("GET /api/auth/login (no session):", health.status, health.json);

  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: { email, password },
  });
  console.log("POST /api/auth/signup:", signup.status, signup.json);

  if (signup.status !== 200) {
    console.error("Signup failed");
    process.exit(1);
  }

  let cookie = signup.setCookie.join("; ");

  if (!cookie || signup.json?.needsConfirmation) {
    console.log("No session after signup (email confirmation may be enabled), trying login…");
    const loginAfterSignup = await request("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    console.log("POST /api/auth/login (after signup):", loginAfterSignup.status, loginAfterSignup.json);
    if (loginAfterSignup.status !== 200) {
      console.error(
        "Login after signup failed. In Supabase → Authentication → Email, disable Confirm email for dev testing.",
      );
      process.exit(1);
    }
    cookie = loginAfterSignup.setCookie.join("; ");
  }

  const me = await request("/api/auth/login", { method: "GET", cookie });
  console.log("GET /api/auth/login (with session):", me.status, me.json);

  if (me.status !== 200 || !me.json?.user) {
    console.error("Session not established after signup");
    process.exit(1);
  }

  await request("/api/auth/logout", { method: "POST", cookie });

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  console.log("POST /api/auth/login:", login.status, login.json);

  if (login.status !== 200) {
    console.error("Login failed");
    process.exit(1);
  }

  console.log("\nAll auth tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
