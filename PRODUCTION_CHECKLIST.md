## Vor dem ersten Demo mit einem echten Kunden

- [ ] SESSION_SECRET gesetzt (min. 32 Zeichen)
- [ ] APOLLO_API_KEY gesetzt (kostenlos: apollo.io → Settings → API)
- [ ] OPENAI_API_KEY gesetzt ($10 bereits vorhanden)
- [ ] /api/health zeigt discovery_provider: "apollo"
- [ ] Erster echter Discovery-Test: ICP definieren → Find Leads → echte Profile erscheinen

## Vor dem ersten zahlenden Kunden

- [ ] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY gesetzt
- [ ] VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY gesetzt
- [ ] Alle Supabase-Migrationen ausgeführt: - 20250503000000_skerry_core.sql - 20250505000000_sequences.sql - 20250505000001_intent_scoring.sql - 20250505000002_ab_testing.sql - 20250505000003_white_label.sql - 20250505000004_audit_log.sql - 20250505000005_gdpr_compliance.sql
- [ ] RESEND_API_KEY gesetzt + Domain verifiziert
- [ ] NEVERBOUNCE_API_KEY gesetzt (optional)
- [ ] STRIPE_SECRET_KEY gesetzt + Preise in Stripe angelegt
- [ ] STRIPE_WEBHOOK_SECRET gesetzt
- [ ] RESEND_WEBHOOK_SECRET gesetzt
- [ ] ALLOW_DEMO_AUTH=false
- [ ] NODE_ENV=production
- [ ] SKERRY_ALLOWED_ORIGINS gesetzt (deine Production-URL)
- [ ] Erster echter End-to-End-Test:
      ICP → Apollo Discovery → OpenAI Enrichment → Email-Draft → Send

## Enterprise-Ready Features (für Agentur-Kunden)

- [ ] Sequence Engine getestet: Sequences erstellen → Leads einschreiben → Follow-ups automatisch
- [ ] Reply Detection funktioniert: Email Events → Intent Score → Sequence pausiert bei Antwort
- [ ] A/B Testing aktiv: 2+ Varianten → 50+ Sends → Gewinner automatisch promoted
- [ ] White-Label konfiguriert: Brand Name, Logo, Color, From Email
- [ ] CSV/CRM Export getestet: Alle Formate (CSV, HubSpot, Salesforce) downloadbar
- [ ] Audit Log prüfen: Alle Aktionen werden protokolliert und exportierbar
- [ ] GDPR-Compliance: Löschanträge, Datenexport, 30-Tage Fristen funktionieren

## Security & Compliance

- [ ] Alle API-Routes haben Zod-Validierung
- [ ] Alle Fehler haben strukturierte code + message Objekte
- [ ] synthesizeServerLeads() wird nur in /api/dev/seed verwendet
- [ ] RLS Policies aktiv für alle Supabase Tabellen
- [ ] Workspace-Isolation funktioniert (keine Cross-Workspace Datenlecks)
- [ ] Rate-Limiting aktiv (express-rate-limit)
- [ ] CSRF-Schutz aktiv (Helmet + SameSite Cookies)
- [ ] HTTPS enforced in Production (SKERRY_ALLOWED_ORIGINS)

## Performance & Monitoring

- [ ] Background Jobs laufen: Sequence Runner (5min), GDPR Processor (24h)
- [ ] Database Indexes vorhanden für schnelle Queries
- [ ] /api/health zeigt alle Service-Status korrekt
- [ ] Memory Usage stabil (< 512MB)
- [ ] Response Times < 2s für alle Endpoints
- [ ] Error Logging funktioniert (logEvent)

## Deployment Checklist

- [ ] Environment Variables komplett:
      DATABASE_URL (PostgreSQL für Entitlements)
      SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
      VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
      APOLLO_API_KEY (kostenlos)
      OPENAI_API_KEY
      RESEND_API_KEY
      NEVERBOUNCE_API_KEY
      STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
      STRIPE_PRICE_SOLO + STRIPE_PRICE_TEAM + STRIPE_PRICE_AGENCY
      RESEND_WEBHOOK_SECRET
      PUBLIC_APP_URL
- [ ] Vercel konfiguriert: vercel.json mit API-Rewrites
- [ ] Custom Domain (optional): DNS + SSL Zertifikat
- [ ] Monitoring: Vercel Analytics + Error Logging
- [ ] Backup: Supabase Daily Backups aktiviert
