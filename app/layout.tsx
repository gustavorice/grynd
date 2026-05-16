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
      appearance={{
        variables: {
          colorPrimary: "#ffffff",
          colorBackground: "#0a0a0a",
          colorText: "#fafafa",
          colorInputBackground: "#0f0f0f",
          colorInputText: "#fafafa",
          borderRadius: "10px"
        }
      }}
    >
      <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
