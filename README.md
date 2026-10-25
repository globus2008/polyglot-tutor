# Polyglot Tutor

A voice conversation tutor for Spanish, English, German, Italian, French and Russian. The UI is available in English and Czech, and explanations, translations and feedback come in the learner's native language. It talks with you through the OpenAI Realtime API, corrects mistakes as you go and, unlike a plain chat, **remembers** what you have covered: topics, recurring mistakes and vocabulary due for review. Each lesson is planned from that history so conversations don't loop back to the same subjects.

Built for slower and quieter speakers too: the tutor can lead the conversation and suggest topics, and you control how long it waits before taking the turn (or switch to push-to-talk so it never interrupts).

Each user brings their own OpenAI API key; a family can share one key.

## Status

| Phase | |
| --- | --- |
| 1. Foundation – auth, schema + RLS, encrypted API keys, learner profiles | ✅ |
| 2. Voice lesson – Realtime over WebRTC, live correction cards | ✅ |
| 3. Memory – lesson analysis, mistakes, vocabulary, topic planner | ✅ |
| 4. Review & progress – spaced repetition, dashboard | ✅ |
| 5. Households – invites, shared key, per-member limits | ✅ |
| 6. PWA & deployment | ✅ |

## Localisation

Pages live under `app/[lang]` (`/en/…`, `/cs/…`). The proxy redirects bare URLs using the `locale` cookie or the browser's `Accept-Language`. UI strings are in `lib/i18n/dictionaries`: `en.ts` defines the shape and every other locale must match it, so a missing translation fails the type check. Server Components use `getDictionary()`, Server Actions and Route Handlers `getRequestDictionary()`, Client Components `useI18n()`.

To add a UI language, add it to `LOCALES` in `lib/i18n/locales.ts` and create a dictionary next to `cs.ts`.

## Stack

- Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS 4
- Supabase – email code / magic-link auth, Postgres with row-level security
- OpenAI Realtime API for voice, `gpt-5.4-mini` (Responses API, structured output) for post-lesson analysis
- ts-fsrs for vocabulary spaced repetition
- Vitest

## Local development

Requires Node 20+ and Docker (for the local Supabase stack).

```bash
npm install
npm run db:start          # local Supabase; applies supabase/migrations
cp .env.example .env.local
```

Fill `.env.local` from `npx supabase status` (publishable and secret key) and generate the encryption secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Then:

```bash
npm run dev               # http://localhost:3000
```

Magic-link emails are caught locally by Mailpit at http://127.0.0.1:54324.

| Script | |
| --- | --- |
| `npm test` | unit tests |
| `npm run typecheck` | TypeScript |
| `npm run db:reset` | recreate the local database from migrations |
| `npm run db:types` | regenerate `lib/supabase/database.types.ts` |

## Security notes

- OpenAI keys are encrypted with AES-256-GCM (`lib/crypto.ts`), bound to their owner, and stored in a table the Data API cannot read. Only the server decrypts them; they never reach the browser.
- `SUPABASE_SECRET_KEY` and `KEY_ENCRYPTION_SECRET` are server-only. Losing or changing `KEY_ENCRYPTION_SECRET` makes stored keys unreadable (users re-enter them).
- Every user table is protected by RLS on `auth.uid()`.

## Deployment

The code is hosted on GitHub; the app runs on [Vercel](https://vercel.com) (imports the GitHub repo and redeploys on every push) with a [Supabase](https://supabase.com) cloud project. Both free tiers are enough for personal and family use. Vercel Cron calls `/api/cron/keepalive` daily (`vercel.json`, authorised by `CRON_SECRET`) so the free Supabase project is never paused for inactivity.

Production environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `KEY_ENCRYPTION_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_CONTACT_EMAIL`. Database changes: `supabase db push`; auth settings and email templates: `supabase config push` (see `[remotes.production]` in `supabase/config.toml`). Sign-in emails need custom SMTP in the Supabase dashboard.

## PWA

`app/manifest.ts`, icons in `public/icons` and a small service worker (`public/sw.js`) that only shows `offline.html` when there is no connection. The app can be installed from Settings → Install on your phone.
