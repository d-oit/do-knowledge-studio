#!/usr/bin/env node
// scripts/corpus-fingerprint.mjs — stable sha256 of a JSON corpus export (#1152).
//
// Shadow comparisons for persistence work: export the store before and after
// a migration (or a kill-the-tab-mid-write run), fingerprint both files, and
// compare. Key order and insignificant whitespace do not affect the hash;
// array order does (arrays are ordered data).
//
// Usage:
//   node scripts/corpus-fingerprint.mjs <export.json>
//   node scripts/corpus-fingerprint.mjs --expect <sha256> <export.json>
//   cat export.json | node scripts/corpus-fingerprint.mjs --stdin
//
// Exit 0 on success (and on --expect match), 1 on invalid input or mismatch.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const EXPECT_FLAG = "--expect";
const STDIN_FLAG = "--stdin";

function fail(message) {
  process.stderr.write(`corpus-fingerprint: ${message}\n`);
  process.exit(1);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fingerprint(text, label) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(`invalid JSON in ${label}`);
  }
  return createHash("sha256").update(canonicalize(parsed)).digest("hex");
}

function main() {
  const args = process.argv.slice(2);
  let expected = null;
  let useStdin = false;
  let file = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === EXPECT_FLAG) {
      expected = args[index + 1];
      index += 1;
    } else if (arg === STDIN_FLAG) {
      useStdin = true;
    } else if (arg.startsWith("--")) {
      fail(`unknown flag ${arg}`);
    } else if (file === null) {
      file = arg;
    } else {
      fail(`unexpected argument ${arg}`);
    }
  }
  if (expected !== null && !/^[0-9a-fA-F]{64}$/.test(expected)) {
    fail("--expect requires a 64-character hex sha256");
  }
  let text;
  let label;
  if (useStdin) {
    try {
      text = readFileSync(0, "utf8");
    } catch {
      fail("could not read stdin");
    }
    label = "stdin";
  } else {
    if (!file) {
      fail("usage: corpus-fingerprint.mjs [--expect <sha256>] <export.json>");
    }
    try {
      text = readFileSync(file, "utf8");
    } catch {
      fail(`could not read ${file}`);
    }
    label = file;
  }
  const digest = fingerprint(text, label);
  if (expected !== null) {
    if (digest !== expected.toLowerCase()) {
      fail(`mismatch for ${label}: got ${digest}, expected ${expected}`);
    }
    process.stdout.write(`match ${digest}  ${label}\n`);
    return;
  }
  process.stdout.write(`${digest}  ${label}\n`);
}

main();
