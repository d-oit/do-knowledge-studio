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
import { normalize, resolve } from "node:path";
import { readTextFile } from "./lib/read-text.mjs";

const EXPECT_FLAG = "--expect";
const STDIN_FLAG = "--stdin";
const CORPUS_EXTENSION = ".json";

function fail(message) {
  process.stderr.write(`corpus-fingerprint: ${message}\n`);
  process.exit(1);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`);
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

async function main() {
  const args = process.argv.slice(2);
  let expected = null;
  let useStdin = false;
  let file = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args.at(index);
    if (arg === EXPECT_FLAG) {
      expected = args.at(index + 1);
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
      fail("usage: corpus-fingerprint.mjs [--expect SHA256] EXPORT.json");
    }
    // The export path comes from argv, so validate its shape before handing
    // it to fs: reject NUL bytes and non-JSON targets, then normalize. The
    // tool runs with the caller's own privileges, but failing fast on a
    // malformed path beats an obscure fs throw or a silent misread.
    if (file.includes("\0")) {
      fail(`refusing to read path containing NUL bytes: ${file}`);
    }
    const resolvedFile = resolve(normalize(file));
    if (!resolvedFile.endsWith(CORPUS_EXTENSION)) {
      fail(`export must be a ${CORPUS_EXTENSION} file: ${file}`);
    }
    try {
      text = await readTextFile(resolvedFile);
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

await main();
