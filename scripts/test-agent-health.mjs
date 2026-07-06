#!/usr/bin/env node
/**
 * Test agent API health (supports ngrok via ngrok-skip-browser-warning).
 * Usage: node scripts/test-agent-health.mjs [baseUrl]
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");

function loadEnv() {
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      if (!process.env[trimmed.slice(0, idx)]) {
        process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
      }
    }
  } catch {
    // optional .env.local
  }
}

function agentHeaders(base) {
  const headers = {};
  if (base.includes("ngrok")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  return headers;
}

async function main() {
  loadEnv();
  const base = (process.argv[2] ?? process.env.ANTIGRAVITY_API_URL ?? "http://127.0.0.1:8765").replace(/\/$/, "");
  const url = `${base}/health`;

  console.log(`GET ${url}`);

  const response = await fetch(url, { headers: agentHeaders(base) });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  console.log(`Status: ${response.status}`);
  console.log(`Content-Type: ${contentType}`);
  console.log(`Body: ${text.slice(0, 200)}`);

  if (!response.ok) {
    console.error("FAIL: non-OK status");
    process.exit(1);
  }

  if (!contentType.includes("application/json")) {
    console.error("FAIL: expected JSON, got HTML or other content (ngrok warning?)");
    process.exit(1);
  }

  const data = JSON.parse(text);
  if (data.status !== "ok") {
    console.error("FAIL: unexpected JSON body");
    process.exit(1);
  }

  console.log("PASS: agent health OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
