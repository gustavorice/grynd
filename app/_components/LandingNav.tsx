"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

type Props = {
  signedIn: boolean;
};

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Planos" },
  { href: "/#faq", label: "FAQ" }
];

export function LandingNav({ signedIn }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Trava scroll quando drawer está aberto.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Fecha drawer ao trocar de rota.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="nav-shell">
        <nav className="nav" aria-label="Principal">
          <Link href="/" className="nav-brand" onClick={() => setOpen(false)} aria-label="Grynd">
            <img src="/grynd-logo.png" alt="Grynd" className="nav-logo" />
          </Link>

          {/* Wrapper invisível centralizado — links flutuam matematicamente no centro do nav. */}
          <div className="nav-center-stage" aria-hidden="false">
            <ul className="nav-links">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={pathname === link.href ? "is-active" : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="nav-actions">
            {signedIn ? (
              <Link href="/app" className="nav-cta">
                Abrir app <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="nav-link">
                  Entrar
                </Link>
                <Link href="/sign-up" className="nav-cta">
                  Criar conta
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="nav-burger"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>
      </div>

      {/* Drawer mobile */}
      <div className={`nav-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
        <ul>
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="nav-drawer-actions">
          {signedIn ? (
            <Link href="/app" className="nav-cta" onClick={() => setOpen(false)}>
              Abrir app <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="nav-link" onClick={() => setOpen(false)}>
                Entrar
              </Link>
              <Link href="/sign-up" className="nav-cta" onClick={() => setOpen(false)}>
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
