import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>Criteria first. Evidence on chain. Validators judge. Code settles.</h1>
      <p className="muted">
        Parlv is evidence infrastructure on GenLayer Studionet. Parties freeze the
        criteria <em>before</em> any evidence is filed. Evidence is stored on chain
        with its digest. Independent validators examine it under consensus. Code —
        not any person — converts that consensus into findings and settles funds.
      </p>
      <div className="card">
        <h2>The trust model in one screen</h2>
        <ol>
          <li><strong>Freeze.</strong> The claimant publishes the claim and criteria; the respondent accepts that exact version by its digest. No moving the goalposts.</li>
          <li><strong>File.</strong> Both sides (and an optional independent inspector) file photos and documents. The contract stores the bytes and computes digests.</li>
          <li><strong>Judge.</strong> GenLayer validators re-examine the stored evidence against the frozen criteria and must agree on what is supported.</li>
          <li><strong>Settle.</strong> Deterministic code converts consensus into findings and moves any held sum: to the claimant <em>only</em> on a final SUPPORTED finding.</li>
        </ol>
        <p className="small muted">
          Uncertainty fails closed. Missing evidence is never proof of anything. No
          operator, admin, or upgrade key exists — and no party can self-certify.
        </p>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Start a case</h3>
          <p className="small muted">Draft the claim and criteria, name the respondent, optionally fund it.</p>
          <Link href="/cases/new"><button>New case</button></Link>
        </div>
        <div className="card">
          <h3>Verify anything</h3>
          <p className="small muted">Recompute terms, evidence, decision, and receipt digests from live chain state.</p>
          <Link href="/verify"><button className="ghost">Open verifier</button></Link>
        </div>
      </div>
      <div className="banner">
        <strong>ACCEPTED ≠ FINALIZED.</strong> An assessment result is a standing
        decision, not authority. Funds move only after the challenge window closes
        and <span className="mono">finalize</span> runs. The app marks every
        non-final state as such.
      </div>
    </>
  );
}
