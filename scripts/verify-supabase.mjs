#!/usr/bin/env node
/** Verify Supabase connection and reports table. */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");

function loadEnv() {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { error } = await supabase.from("reports").select("id").limit(1);

  if (error) {
    console.error("Supabase reports table check failed:", error.message);
    console.error("Did you run supabase/schema.sql in SQL Editor?");
    process.exit(1);
  }

  console.log("Supabase OK — reports table reachable.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
