import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parlv — criteria first, evidence on chain",
  description:
    "Freeze criteria before evidence. Validators judge. Code settles. No self-certification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link className="brand" href="/">Parlv</Link>
          <span className="tagline">Criteria first. Evidence on chain. Validators judge. Code settles.</span>
          <nav>
            <Link href="/cases">Cases</Link>
            <Link href="/cases/new">New case</Link>
            <Link href="/verify">Verify</Link>
            <Link href="/status">Status</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <span>Studionet only (chain 61999). Everything is public and permanent.</span>
        </footer>
      </body>
    </html>
  );
}
