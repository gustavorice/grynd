import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <div className="auth-stack">
        <Link className="auth-brand" href="/">
          <span className="lp-brand-mark">G</span>
          Grynd
        </Link>
        <SignUp
          appearance={{
            variables: {
              colorPrimary: "#ffffff",
              colorBackground: "#0a0a0a",
              colorText: "#fafafa",
              colorTextSecondary: "#a1a1aa",
              colorInputBackground: "#0f0f0f",
              colorInputText: "#fafafa",
              colorNeutral: "#fafafa",
              borderRadius: "10px",
              fontFamily: "var(--font-geist-sans)"
            },
            elements: {
              card: { boxShadow: "none", border: "1px solid rgba(255,255,255,0.08)" },
              formButtonPrimary: { fontWeight: 600 },
              footerActionLink: { color: "#fafafa", fontWeight: 500 }
            }
          }}
        />
        <p className="auth-foot">
          Voltar pra <Link href="/">página inicial</Link>
        </p>
      </div>
    </main>
  );
}
