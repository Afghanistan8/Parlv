"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { view } from "../../lib/client";

interface Summary {
  case_id: string;
  state: string;
  title: string;
  subject_kind: string;
  overall: string;
}

export default function CasesPage() {
  const [cases, setCases] = useState<Summary[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    view<{ total: number; cases: Summary[] }>("list_cases", [0, 50])
      .then((r) => {
        setCases(r.cases);
        setTotal(r.total);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <h1>Cases ({total})</h1>
      <p><Link href="/cases/new"><button>New case</button></Link></p>
      {error && <div className="card error">{error}</div>}
      {cases.map((c) => (
        <div className="card" key={c.case_id}>
          <Link href={`/cases/${c.case_id}`}><strong className="mono">{c.case_id}</strong> — {c.title}</Link>
          <div className="small muted">
            <span className={`pill ${c.state === "FINAL" ? "final" : c.state === "OPEN" ? "open" : ""}`}>{c.state}</span>{" "}
            {c.subject_kind} {c.overall && <>· {c.overall}</>}
          </div>
        </div>
      ))}
      {cases.length === 0 && !error && <p className="muted">No cases yet.</p>}
    </>
  );
}
