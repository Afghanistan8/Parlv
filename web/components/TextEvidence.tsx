"use client";

/**
 * Filing a text document (`submit_text`). The contract bounds the body, derives
 * the SHA-256 itself, and stores the text; the app only shapes the request.
 */

import { useState } from "react";
import { CONTRACT_LIMITS } from "../lib/config";
import { DOC_TYPES } from "../lib/terms";

export function TextEvidence({
  criteriaIds,
  enabled,
  why,
  busy,
  submit,
}: {
  criteriaIds: string[];
  enabled: boolean;
  why: string;
  busy: boolean;
  submit: (metaJson: string, text: string) => void;
}) {
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  function send() {
    const body = text.trim();
    if (body.length < 10) return setError("A document needs at least 10 characters of text.");
    if (body.length > CONTRACT_LIMITS.text) {
      return setError(`A document may be at most ${CONTRACT_LIMITS.text} characters.`);
    }
    setError("");
    submit(
      JSON.stringify({
        doc_type: docType,
        title: title.trim(),
        file_name: fileName.trim() || "document.txt",
        description: description.trim(),
        criteria: criteriaIds,
      }),
      body,
    );
  }

  return (
    <div>
      <label>File a text document (typed evidence, hashed by the contract)</label>
      <select value={docType} onChange={(e) => setDocType(e.target.value)} disabled={!enabled}>
        {DOC_TYPES.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Document title"
        maxLength={CONTRACT_LIMITS.title}
        disabled={!enabled}
      />
      <input
        type="text"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        placeholder="File name (optional)"
        maxLength={CONTRACT_LIMITS.fileName}
        disabled={!enabled}
      />
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`The text of the document (10–${CONTRACT_LIMITS.text} characters)`}
        disabled={!enabled}
      />
      <textarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short description (optional)"
        maxLength={CONTRACT_LIMITS.line}
        disabled={!enabled}
      />
      {error && <div className="error">{error}</div>}
      <button disabled={!enabled || busy} onClick={send}>
        {busy ? "Signing…" : "File text document (sign with wallet)"}
      </button>
      {!enabled && <div className="small muted">{why}</div>}
    </div>
  );
}
