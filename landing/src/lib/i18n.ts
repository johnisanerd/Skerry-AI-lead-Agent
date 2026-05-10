export type Lang = "en" | "de";

const dict = {
  en: {
    "nav.features": "Features",
    "nav.demo": "Demo",
    "nav.faq": "FAQ",
    "nav.cta": "Join the waitlist",

    "hero.eyebrow": "Private beta · Coming Q3 2026",
    "hero.title.before": "The AI sales agent your team",
    "hero.title.accent": "forgot to hire.",
    "hero.subtitle":
      "Tell Skerry your ICP. Get back verified prospects, deeply researched, with a personalized first-touch email — ready to push to Instantly. No SDR seat. No Apollo subscription. No spreadsheets.",
    "hero.badge.gdpr": "GDPR-ready · EU data residency",
    "hero.badge.apollo": "Apollo + verified email built-in",
    "hero.badge.instantly": "1-click push to Instantly",

    "form.placeholder": "you@company.com",
    "form.submit": "Join the waitlist",
    "form.success.title": "You're in",
    "form.success.copy.new": "Confirmation email on the way.",
    "form.success.copy.dup":
      "You were already on the list — good thing we double-check.",
    "form.success.cta": "Skip the queue — €19 founding spot →",
    "form.success.note": "Refundable. 50% off lifetime when we open.",
    "form.error.generic": "Couldn't join — try again.",

    "demo.eyebrow": "See it live",
    "demo.title.before": "From ICP to inbox",
    "demo.title.accent": "in real time.",
    "demo.subtitle":
      "Describe your ideal customer in plain words. Skerry sources verified prospects, drafts personalized outreach, and pushes to Instantly — all in one workflow.",
    "demo.url": "app.skerry.cloud/agent",
    "demo.stage.input": "Skerry is reading your ICP…",
    "demo.stage.research": "Sourcing prospects via Apollo + Apify…",
    "demo.stage.draft": "Drafting personalized emails with GPT…",
    "demo.stage.send": "Pushing to Instantly…",
    "demo.stage.done": "Done — emails are out.",
    "demo.icp":
      "B2B SaaS founders in Berlin, 50–200 employees, raised Series A in the last 12 months",
    "demo.contacts": "1,847 prospects analyzed",
    "demo.results.title": "Found",
    "demo.results.suffix": "verified leads in your ICP",
    "demo.results.count": "results",
    "demo.results.match": "match",
    "demo.viewall": "View all",
    "demo.email.subject": "Quick idea after your Series A",
    "demo.email.body":
      "Saw the funding announcement — congrats. We're building the AI agent founders use to hit pipeline goals without growing the SDR team. 30-second demo if it lands.",
    "demo.email.sentvia": "Sent via Instantly",

    "how.eyebrow": "How it works",
    "how.title": "From ICP to inbox in four steps.",
    "how.s1.title": "Define your ICP",
    "how.s1.body":
      "Vertical, headcount, region, role. Or paste a target customer URL.",
    "how.s2.title": "Skerry researches",
    "how.s2.body":
      "Apollo for sourcing, Apify for enrichment, NeverBounce for deliverability.",
    "how.s3.title": "AI drafts personalized outreach",
    "how.s3.body":
      "GPT-4-class copy, grounded in each prospect's actual context — not generic merge tags.",
    "how.s4.title": "Push to Instantly",
    "how.s4.body":
      "One click. Or export CSV. Or hand off to your existing tool.",

    "found.eyebrow": "Founding members",
    "found.title.before": "Lock",
    "found.title.accent": "50% off",
    "found.title.after": "for life.",
    "found.body":
      "The first 100 customers get half-price for as long as they stay subscribed. Pay €19 now to reserve your spot — fully refundable any time before launch. No catch, no auto-charge, no upsell traps.",
    "found.bullet.1": "50% off any plan, locked for life",
    "found.bullet.2": "First access — at least two weeks before public launch",
    "found.bullet.3": "Direct line to the founder for feedback that ships",
    "found.bullet.4": "100% refund any time before we go live",
    "found.card.title": "Founding spot",
    "found.card.priceNote": "refundable deposit",
    "found.card.foot":
      "Locks 50% off lifetime. Applied as credit on your first invoice.",

    "plans.eyebrow": "Plans at launch",
    "plans.title": "Pricing you can scale into.",
    "plans.subtitle":
      "Final pricing TBD — what's locked is the 50% founding discount. Indicative tiers below.",
    "plans.popular": "Most popular",
    "plans.solo.who": "Indie founders, freelancers",
    "plans.team.who": "1–10 person sales orgs",
    "plans.agency.who": "Outbound shops, multi-tenant",
    "plans.feat.runs": "lead-runs / month",
    "plans.feat.leads": "verified leads / run",
    "plans.feat.unlimited": "Unlimited runs",

    "faq.eyebrow": "FAQ",
    "faq.title": "Common questions.",
    "faq.q1": "When does Skerry launch?",
    "faq.a1":
      "Private beta opens Q3 2026. Founding members get access at least two weeks before public launch.",
    "faq.q2": "Is the €19 deposit really refundable?",
    "faq.a2":
      "Yes. Email us before launch and we refund in full, no questions. After launch it converts to credit on your first invoice.",
    "faq.q3": "Where does the data come from?",
    "faq.a3":
      "Sourcing via Apollo, enrichment via Apify, deliverability checks via NeverBounce, drafting via OpenAI. We don't scrape unauthorized sources.",
    "faq.q4": "How is this different from Apollo + ChatGPT?",
    "faq.a4":
      "Skerry is one workflow with shared context. The same prospect data that finds the lead also writes the email — so personalization is grounded, not hallucinated. No copy-paste between tools.",
    "faq.q5": "GDPR / data residency?",
    "faq.a5":
      "EU residency available at launch (Frankfurt). Full DPA + subprocessor list published before public launch.",
    "faq.q6": "Do I need Instantly?",
    "faq.a6":
      "No. Instantly is the easiest push, but you can also export CSV or use any sender via API.",

    "bottom.title": "Get on the list. Skip the queue if you mean it.",
    "bottom.subtitle":
      "We'd rather have 100 customers who paid €19 than 10,000 who clicked once. If pipeline matters to you, lock founding pricing now.",

    "footer.tagline": "Built for founders who hate writing follow-ups.",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
  },
  de: {
    "nav.features": "Features",
    "nav.demo": "Demo",
    "nav.faq": "FAQ",
    "nav.cta": "Zur Warteliste",

    "hero.eyebrow": "Private Beta · Q3 2026",
    "hero.title.before": "Der KI-Sales-Agent, den dein Team",
    "hero.title.accent": "vergessen hat einzustellen.",
    "hero.subtitle":
      "Sag Skerry deine ICP. Bekomm verifizierte Prospects zurück, tief recherchiert, mit personalisierter Erst-Mail — bereit zum Push an Instantly. Kein SDR-Seat. Kein Apollo-Abo. Keine Tabellen.",
    "hero.badge.gdpr": "DSGVO-ready · EU Data Residency",
    "hero.badge.apollo": "Apollo + verifizierte Mail eingebaut",
    "hero.badge.instantly": "1-Klick Push zu Instantly",

    "form.placeholder": "du@firma.com",
    "form.submit": "Zur Warteliste",
    "form.success.title": "Drin.",
    "form.success.copy.new": "Bestätigungsmail kommt gleich.",
    "form.success.copy.dup":
      "Du warst schon auf der Liste — gut dass wir nochmal prüfen.",
    "form.success.cta": "Vor in der Schlange — €19 Founding Spot →",
    "form.success.note":
      "Erstattbar. 50% lebenslanger Rabatt sobald wir öffnen.",
    "form.error.generic": "Hat nicht geklappt — nochmal probieren.",

    "demo.eyebrow": "Live ansehen",
    "demo.title.before": "Von ICP zur Inbox —",
    "demo.title.accent": "in Echtzeit.",
    "demo.subtitle":
      "Beschreib deinen perfekten Kunden in einem Satz. Skerry findet verifizierte Prospects, schreibt personalisierte Outreach-Mails und pusht an Instantly — alles in einem Flow.",
    "demo.url": "app.skerry.cloud/agent",
    "demo.stage.input": "Skerry liest deine ICP…",
    "demo.stage.research": "Source via Apollo + Apify…",
    "demo.stage.draft": "Schreibt personalisierte Mails mit GPT…",
    "demo.stage.send": "Push zu Instantly…",
    "demo.stage.done": "Fertig — Mails sind raus.",
    "demo.icp":
      "B2B SaaS Founder in Berlin, 50–200 Mitarbeiter, Series A in den letzten 12 Monaten",
    "demo.contacts": "1.847 Prospects analysiert",
    "demo.results.title": "Gefunden:",
    "demo.results.suffix": "verifizierte Leads in deiner ICP",
    "demo.results.count": "Treffer",
    "demo.results.match": "Match",
    "demo.viewall": "Alle anzeigen",
    "demo.email.subject": "Kurzer Gedanke nach eurer Series A",
    "demo.email.body":
      "Hab eure Funding-News gesehen — Glückwunsch. Wir bauen den KI-Agent, mit dem Founder Pipeline-Ziele treffen ohne SDR-Team aufzubauen. 30-Sekunden-Demo wenn's passt.",
    "demo.email.sentvia": "Gesendet via Instantly",

    "how.eyebrow": "So funktioniert's",
    "how.title": "Von ICP zur Inbox in vier Schritten.",
    "how.s1.title": "ICP definieren",
    "how.s1.body":
      "Branche, Mitarbeiterzahl, Region, Rolle. Oder URL eines Beispiel-Kunden.",
    "how.s2.title": "Skerry recherchiert",
    "how.s2.body":
      "Apollo zum Sourcen, Apify zum Anreichern, NeverBounce für Zustellbarkeit.",
    "how.s3.title": "KI schreibt personalisierte Outreach",
    "how.s3.body":
      "GPT-4-Klasse Copy, basierend auf echtem Kontext — keine generischen Merge-Tags.",
    "how.s4.title": "Push zu Instantly",
    "how.s4.body":
      "Ein Klick. Oder CSV-Export. Oder Übergabe an dein bestehendes Tool.",

    "found.eyebrow": "Founding Members",
    "found.title.before": "Sichere",
    "found.title.accent": "50% Rabatt",
    "found.title.after": "auf Lebenszeit.",
    "found.body":
      "Die ersten 100 Kunden bekommen halben Preis, solange sie Kunde bleiben. €19 jetzt zahlen und Spot reservieren — komplett erstattbar bis zum Launch. Kein Trick, keine Auto-Charge, keine Upsell-Falle.",
    "found.bullet.1": "50% Rabatt auf jeden Plan, dauerhaft",
    "found.bullet.2":
      "First Access — mindestens 2 Wochen vor Public Launch",
    "found.bullet.3": "Direkter Draht zum Gründer für ehrliches Feedback",
    "found.bullet.4": "100% Erstattung jederzeit vor Live-Gang",
    "found.card.title": "Founding Spot",
    "found.card.priceNote": "erstattbare Anzahlung",
    "found.card.foot":
      "Sichert 50% lebenslang. Wird auf erste Rechnung gutgeschrieben.",

    "plans.eyebrow": "Pläne zum Launch",
    "plans.title": "Pricing zum reinwachsen.",
    "plans.subtitle":
      "Finales Pricing offen — fest ist der 50%-Founding-Rabatt. Richtwerte unten.",
    "plans.popular": "Beliebt",
    "plans.solo.who": "Indie-Founder, Freelancer",
    "plans.team.who": "1–10 Personen Sales-Teams",
    "plans.agency.who": "Outbound-Agenturen, multi-tenant",
    "plans.feat.runs": "Lead-Runs / Monat",
    "plans.feat.leads": "verifizierte Leads / Run",
    "plans.feat.unlimited": "Unlimitierte Runs",

    "faq.eyebrow": "FAQ",
    "faq.title": "Häufige Fragen.",
    "faq.q1": "Wann launcht Skerry?",
    "faq.a1":
      "Private Beta öffnet Q3 2026. Founding Members bekommen mindestens 2 Wochen vor Public Launch Zugang.",
    "faq.q2": "Ist die €19-Anzahlung wirklich erstattbar?",
    "faq.a2":
      "Ja. Mail vor Launch und wir erstatten komplett, ohne Fragen. Nach Launch wird's auf die erste Rechnung gutgeschrieben.",
    "faq.q3": "Woher kommen die Daten?",
    "faq.a3":
      "Sourcing via Apollo, Anreicherung via Apify, Zustellbarkeit via NeverBounce, Drafting via OpenAI. Keine unautorisierten Quellen.",
    "faq.q4": "Was unterscheidet das von Apollo + ChatGPT?",
    "faq.a4":
      "Skerry ist ein Flow mit geteiltem Kontext. Dieselben Prospect-Daten, die den Lead finden, schreiben auch die Mail — Personalisierung ist fundiert, nicht halluziniert. Kein Copy-Paste zwischen Tools.",
    "faq.q5": "DSGVO / Data Residency?",
    "faq.a5":
      "EU-Residency zum Launch (Frankfurt). Vollständige AVV + Subprocessor-Liste vor Public Launch.",
    "faq.q6": "Brauch ich Instantly?",
    "faq.a6":
      "Nein. Instantly ist der einfachste Push, du kannst aber auch CSV exportieren oder jeden Sender via API nutzen.",

    "bottom.title": "Auf die Liste. Vordrängeln wenn du's ernst meinst.",
    "bottom.subtitle":
      "Lieber 100 Kunden mit €19 Anzahlung als 10.000 die einmal klicken. Wenn Pipeline für dich zählt, sichere dir den Founding-Preis.",

    "footer.tagline":
      "Gebaut für Founder, die keine Lust auf Follow-up-Schreiben haben.",
    "footer.privacy": "Datenschutz",
    "footer.terms": "Nutzungsbedingungen",
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type StringKey = keyof typeof dict.en;

export function t(lang: Lang, key: StringKey): string {
  return dict[lang][key] ?? dict.en[key];
}

export function detectLang(request: Request): Lang {
  const url = new URL(request.url);
  const param = url.searchParams.get("lang");
  if (param === "de" || param === "en") return param;
  const cookie = request.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)lang=(de|en)/);
  if (m) return m[1] as Lang;
  const accept = request.headers.get("accept-language") ?? "";
  if (/^de\b|^de-/i.test(accept)) return "de";
  return "en";
}
