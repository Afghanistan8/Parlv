import Link from "next/link";

const STEPS = [
  {
    n: "1",
    title: "Freeze",
    body: "The claimant publishes the claim and the criteria. The respondent accepts that exact version by its digest — the goalposts cannot move afterwards.",
  },
  {
    n: "2",
    title: "File",
    body: "Both sides, plus an optional independent inspector, file photos and documents. The contract stores the bytes and computes every digest on chain.",
  },
  {
    n: "3",
    title: "Judge",
    body: "GenLayer validators re-examine the stored evidence against the frozen criteria and must agree on what each criterion supports.",
  },
  {
    n: "4",
    title: "Settle",
    body: "Deterministic code turns that consensus into findings and moves any held sum — to the claimant only on a final SUPPORTED finding.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <span className="eyebrow">Evidence infrastructure · GenLayer Studionet</span>
        <h1 className="hero-title">
          Freeze the rules. <span className="grad">Then let the evidence speak.</span>
        </h1>
        <p className="lead">
          Parlv locks the criteria <em>before</em> a single byte of evidence is filed. Independent
          validators assess what is on chain under consensus. Deterministic code — never an
          operator — turns that verdict into a settlement.
        </p>
      </section>

      <div className="card">
        <h2>How a case resolves</h2>
        <ol className="steps">
          {STEPS.map((s) => (
            <li className="step" key={s.n}>
              <span className="step-num">{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="note">
          Uncertainty fails closed. Missing evidence proves nothing. There is no owner, admin,
          operator, or upgrade key — and no party can certify its own claim.
        </p>
      </div>

      <div className="cta-grid">
        <Link className="cta" href="/cases/new">
          <h3>Open a case</h3>
          <p>Draft the claim and criteria, name the respondent, optionally fund the sum.</p>
          <span className="cta-go">New case →</span>
        </Link>
        <Link className="cta" href="/verify">
          <h3>Verify a case</h3>
          <p>Recompute the terms, evidence, decision, and receipt digests from live chain state.</p>
          <span className="cta-go">Open verifier →</span>
        </Link>
      </div>

      <div className="banner">
        <strong>ACCEPTED is not FINALIZED.</strong> An assessment result is a standing decision,
        not authority. Funds move only after the challenge window closes and{" "}
        <span className="mono">finalize</span> runs. The app labels every non-final state.
      </div>
    </>
  );
}
