#!/usr/bin/env node
/**
 * Live smoke test: read the deployed Parlv contract on Studionet through the
 * same client path the browser app uses, and assert the invariants the app
 * depends on. Read-only, safe to run any time, exits non-zero on any failure.
 *
 *   node scripts/live-smoke.mjs
 *
 * It deliberately uses transactionHashVariant "latest-final" — the variant the
 * network serves. The genlayer-js default ("latest-nonfinal") is rejected by
 * this RPC, which is exactly the class of drift this test exists to catch.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const here = dirname(fileURLToPath(import.meta.url));
const config = readFileSync(join(here, "..", "lib", "config.ts"), "utf8");

const ADDRESS = /PARLV_CONTRACT_FALLBACK\s*=\s*"(0x[0-9a-fA-F]{40})"/.exec(config)?.[1];
const RULES = /PARLV_RULES\s*=\s*"([^"]+)"/.exec(config)?.[1];
const CHAIN = Number(/STUDIONET_CHAIN_ID\s*=\s*(\d+)/.exec(config)?.[1]);
const RPC = /STUDIONET_RPC_URL\s*=\s*"([^"]+)"/.exec(config)?.[1];

if (!ADDRESS || !RULES || !CHAIN || !RPC) {
  console.error("could not parse the contract address / rules / chain from web/lib/config.ts");
  process.exit(1);
}

console.log(`network    studionet (chain ${CHAIN}, ${RPC})`);
console.log(`contract   ${ADDRESS}`);
console.log("");

const client = createClient({ chain: studionet, endpoint: RPC });
const results = [];

function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function read(functionName, args = []) {
  const t0 = Date.now();
  const raw = await Promise.race([
    client.readContract({ address: ADDRESS, functionName, args, transactionHashVariant: "latest-final" }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("read timed out after 20s")), 20000)),
  ]);
  return { value: typeof raw === "string" ? JSON.parse(raw) : raw, ms: Date.now() - t0 };
}

try {
  const cfg = await read("get_config");
  check("get_config returns the app's rules id", cfg.value.rules === RULES, `${cfg.value.rules} · ${cfg.ms}ms`);
  check("get_config reports Studionet", cfg.value.chain_id === CHAIN, `chain ${cfg.value.chain_id}`);

  const gov = await read("get_governance");
  check("no admin key", gov.value.has_admin_key === false);
  check("no upgrade key", gov.value.has_upgrade_key === false);
  check("deployer holds no power", gov.value.deployer_has_power === false);

  const list = await read("list_cases", [0, 50]);
  check(
    "list_cases returns a page",
    Array.isArray(list.value.cases) && typeof list.value.total === "number",
    `${list.value.total} case(s) · ${list.ms}ms`,
  );
} catch (e) {
  check("live reads", false, String(e).slice(0, 240));
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
