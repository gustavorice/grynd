import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grynd — Prospecção local sem complicação",
  description:
    "Encontre leads do seu nicho com WhatsApp, redes sociais e contato. Multi-fonte, rápido, focado no Brasil.",
  metadataBase: new URL("https://grynd.com.br"),
  openGraph: {
    title: "Grynd",
    description: "Prospecção local sem complicação.",
    url: "https://grynd.com.br",
    siteName: "Grynd",
    locale: "pt_BR",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      afterSignOutUrl="/sign-in"
      appearance={{
        variables: {
          colorPrimary: "#ffffff",
          colorBackground: "#0a0a0a",
          colorText: "#fafafa",
          colorTextSecondary: "#a1a1aa",
          colorTextOnPrimaryBackground: "#0a0a0a",
          colorInputBackground: "#0f0f0f",
          colorInputText: "#fafafa",
          colorNeutral: "#fafafa",
          colorDanger: "#ef4444",
          borderRadius: "10px",
          fontFamily: "var(--font-geist-sans)"
        },
        elements: {
          userButtonPopoverCard: {
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          },
          userButtonPopoverActionButton: {
            color: "#fafafa"
          },
          userButtonPopoverActionButton__signOut: {
            color: "#fafafa"
          },
          userButtonPopoverActionButtonText: {
            color: "#fafafa"
          },
          userButtonPopoverActionButtonIcon: {
            color: "#fafafa"
          },
          userButtonPopoverFooter: {
            display: "none"
          },
          userPreviewMainIdentifier: {
            color: "#fafafa"
          },
          userPreviewSecondaryIdentifier: {
            color: "#a1a1aa"
          }
        }
      }}
    >
      <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
