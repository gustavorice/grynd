"use client";

import { useEffect } from "react";

/**
 * O Clerk injeta um badge "Development mode" e um "Secured by Clerk" no fim do
 * card de auth. Não é configurável via appearance prop. Esse componente caça
 * essas pílulas e mata, inclusive após hidratação tardia.
 */
export function ClerkBadgeKiller() {
  useEffect(() => {
    const PATTERNS = [
      "development mode",
      "modo de desenvolvimento",
      "secured by clerk",
      "powered by clerk"
    ];

    const sweep = () => {
      const candidates = document.querySelectorAll<HTMLElement>(
        '[class*="cl-internal"], .cl-badge, [data-localization-key], .cl-footer, .cl-poweredBy'
      );
      candidates.forEach((el) => {
        const text = (el.textContent ?? "").trim().toLowerCase();
        if (PATTERNS.some((p) => text.includes(p)) && text.length < 80) {
          el.style.display = "none";
        }
      });
    };

    sweep();

    const observer = new MutationObserver(() => sweep());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
