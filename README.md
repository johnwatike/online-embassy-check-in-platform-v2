# Embassy Connect — Online Embassy Check‑in Platform (Kenya pilot)

A full‑stack pilot platform prepared for the **Republic of Kenya — Ministry of Foreign Affairs**:
Kenyans travelling or living abroad can register trips, check in on arrival, receive verified
mission alerts, respond to crisis wellbeing checks, and request consular assistance. Mission
staff get a least‑privilege staff portal for registrations, cases, appointments, alerts,
crisis checks, audit and aggregate reporting.

> **Pilot prototype.** All people, addresses, phone numbers, emails and opening hours in the
> seed data are fictional placeholders. The coat of arms / ministry seal artwork in `public/`
> is illustrative and must be replaced with official marks before launch.

## Stack

- **Next.js 16** (App Router, Server Actions, React 19) + **Tailwind CSS 4**
- **SQLite** (`better-sqlite3`) + **Drizzle ORM** (schema in `src/db/schema.ts`); the database
  file `data/app.db` is **committed to git**, so the sample data ships with the source
- Interactive check‑in map via **Leaflet** with free tile layers (CARTO Voyager / OpenStreetMap / Esri satellite)

## Branding

| Element | Value |
| --- | --- |
| Flag palette | Black `#000000`, Red `#BB0000`, Green `#006600`, White `#FFFFFF` (plus coat‑of‑arms gold `#C99700`) |
| Ministry surfaces | Deep navy `#0A1F44` (mfa.go.ke) with gold accents |
| Typography | **Inter Variable** — the family used by the eCitizen portal (`ecitizen.go.ke`), self‑hosted via `@fontsource-variable/inter` |
| Logos | `public/kenya-coat-of-arms.png` (coat of arms) and `public/mfa-logo.png` (ministry seal); `src/app/icon.png` is the favicon |
| Flag stripe | `KenyaStripe` component renders the black–white–red–white–green band on every header |

Tailwind scales `teal-*` and `red-*` are remapped in `src/app/globals.css` to the Kenyan green
and red families, so the whole app (buttons, badges, charts, focus rings) stays on‑brand.

## Quick start

```bash
npm install
npm run dev                          # http://localhost:3000
```

No database server is needed: the app reads and writes the committed `data/app.db`
SQLite file directly. `drizzle-kit push` is only required after schema changes
(config in `drizzle.config.json`).

The database ships with sample missions (following the Ministry's published directory),
citizens, staff, trips, cases, alerts, appointments and a crisis event; if the file is ever
emptied it re-seeds itself on first request. Open `/sign-in` and pick a persona — e.g.
**Wanjiku Mwangi** (citizen) or **Mercy Atieno** (consular officer, Dubai).
`/api/demo/reset` restores the original sample state.

Scripts: `npm run dev | build | start | lint | typecheck`.

## Portals & routes

- **Public** — `/` home, `/embassies` mission directory, `/guidance`, `/privacy`
- **Citizen** — `/app` dashboard, trips wizard (hotel name + address with automatically picked
  coordinates from the bundled offline `all-the-cities` dataset), status check‑in, alerts,
  help/cases with messaging and attachments, appointments, printable emergency contact card
  (`/api/card`), profile
- **Staff** — `/staff` dashboard, registrations, **check‑in map** (`/staff/map`, Leaflet,
  mission‑scoped), cases, alerts (draft/publish), crisis wellbeing checks, appointments,
  mission settings, roles & audit (permission‑gated)
- **i18n** — English / Kiswahili switch (EN | SW) on the main screens

## Notes for the Ministry

- `next.config.ts` lists preview origins for Server Actions; set `ALLOWED_ORIGINS` for production.
- Demo sessions use an httpOnly cookie; in embedded previews that refuse all cookies, a signed
  `ecs` URL token (forwarded by `src/proxy.ts`) keeps the demo usable. Replace with real
  authentication (OIDC/SAML SSO with MFA for staff) before launch.
- Delivery of email/SMS/push is simulated. Real identity, SSO/MFA and payment integrations are
  out of scope for the pilot.
- Kiswahili strings in `src/lib/i18n.ts` must be reviewed by a qualified translator.
