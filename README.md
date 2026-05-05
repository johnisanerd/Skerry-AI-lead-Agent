# Skerry AI Agent

Autonomer Revenue-Operations-Co-Pilot für Agenturen und B2B-Businesses.

## Schnellstart (5 Minuten)

1. `cp env.example .env` → Keys eintragen (mindestens SESSION_SECRET + APOLLO_API_KEY)
2. `pnpm install`
3. `pnpm dev`
4. Browser: http://localhost:3000
5. Demo-Login: solo@skerry.io / solo123

## Discovery Setup (kostenlos)

Apollo.io: https://app.apollo.io/settings/integrations/api
→ API Key kopieren → APOLLO_API_KEY in .env
Free Plan: bis zu 10.000 Email-Credits/Monat

## Supabase Setup (kostenlos)

1. Projekt auf supabase.com erstellen
2. SQL ausführen: supabase/migrations/20250503000000_skerry_core.sql
3. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
4. VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env

## Health Check

http://localhost:3001/api/health
→ zeigt welche Services konfiguriert sind

## Production Deploy (Vercel)

1. `vercel`
2. Alle Env-Vars in Vercel-Dashboard setzen
3. SKERRY_ALLOWED_ORIGINS=https://your-app.vercel.app
4. ALLOW_DEMO_AUTH=false
5. NODE_ENV=production
