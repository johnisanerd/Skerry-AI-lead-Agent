import { useState, useEffect } from "react";

type Lang = "en" | "de";

function readLang(): Lang {
  if (typeof document === "undefined") return "en";
  const root = document.documentElement.getAttribute("lang");
  return root === "de" ? "de" : "en";
}

export default function LanguageToggle() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    setLang(readLang());
  }, []);

  function switchTo(next: Lang) {
    if (next === lang) return;
    document.cookie = `lang=${next};path=/;max-age=31536000;samesite=lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.location.href = url.toString();
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex rounded-full border border-zinc-300/60 bg-white/60 p-0.5 text-[11px] font-semibold uppercase tracking-wider dark:border-white/10 dark:bg-white/5"
    >
      {(["en", "de"] as const).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => switchTo(code)}
            aria-pressed={active}
            className={`min-w-[32px] rounded-full px-2.5 py-1.5 transition ${
              active
                ? "bg-brand-gradient text-ink-900 shadow-[0_0_18px_rgba(167,139,250,0.45)]"
                : "text-zinc-600 hover:text-zinc-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
