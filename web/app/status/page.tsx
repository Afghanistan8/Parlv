"use client";

import { useEffect, useState } from "react";
import { getContract, view } from "../../lib/client";
import { PARLV_RULES, STUDIONET_CHAIN_ID, STUDIONET_EXPLORER, STUDIONET_RPC_URL } from "../../lib/config";

export default function StatusPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    view<Record<string, unknown>>("get_config", [])
      .then(setConfig)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <h1>Network status</h1>
      <div className="card small">
        <div>Network: <strong>Studionet</strong> (chain {STUDIONET_CHAIN_ID})</div>
        <div>RPC: <span className="mono">{STUDIONET_RPC_URL}</span></div>
        <div>Contract: <span className="mono">{getContract()}</span></div>
        <div>
          Explorer:{" "}
          <a href={`${STUDIONET_EXPLORER}/address/${getContract()}`} target="_blank" rel="noreferrer">
            {STUDIONET_EXPLORER}/address/{getContract()}
          </a>
        </div>
      </div>
      {error && <div className="card error">{error}</div>}
      {config && (
        <div className="card small">
          <div>Rules: <span className="mono">{String(config.rules)} (expected {PARLV_RULES})</span></div>
          <div>Chain (contract): <span className="mono">{String(config.chain_id)}</span></div>
          <div>Subject kinds: <span className="mono">{Object.keys((config.subject_kinds as object) ?? {}).join(", ")}</span></div>
          <div>Findings: <span className="mono">{(config.findings as string[]).join(" / ")}</span></div>
        </div>
      )}
    </>
  );
}
