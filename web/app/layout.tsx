import type { Metadata } from "next";
import Link from "next/link";
import { WalletBar, WalletProvider } from "../components/Wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parlv — criteria first, evidence on chain",
  description:
    "Freeze the criteria before any evidence is filed. Independent validators judge what is on chain. Deterministic code settles. No self-certification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <header className="topbar">
            <div className="topbar-inner">
              <Link className="brand" href="/">
                <span className="brand-mark" aria-hidden="true" />
                Parlv
              </Link>
              <nav>
                <Link href="/cases">Cases</Link>
                <Link href="/cases/new">New case</Link>
                <Link href="/verify">Verify</Link>
                <Link href="/status">Status</Link>
              </nav>
              <WalletBar />
            </div>
          </header>
          <main>{children}</main>
          <footer>
            <span>Studionet only · chain 61999 · everything public and permanent</span>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
