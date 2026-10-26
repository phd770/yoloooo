# my baby land

Private Hebrew RTL app for two profiles, Boaz and Mishel. Login uses a personal
four-digit PIN. No Google sign-in, Gemini key, or AI Studio connection is used.

## What is included

- A rebuilt responsive home, navigation, login, chat, mission inbox, vault and settings.
- Chat drafts, acknowledged sends, replies, edits, reactions, audio, media, location,
  view-once messages, expiring messages and per-profile hidden history.
- Mission creation, reusable ideas, responses, photos, completion and transactional points.
- A shared media vault with live updates, upload validation and explicit failure states.
- Four shared games. Tic-tac-toe was rebuilt; the existing Connect Four, Dots and Boxes
  and Backgammon engines remain, with additional concurrency protection for the latter two.
- PIN changes in settings. The current PIN and an authenticated matching identity are required.

## Local development

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and configure the existing owner's Firebase
   service-account JSON and the two initial PIN hashes locally. Never commit secrets.
3. Run `npm run dev`. The same `/api/auth` and `/api/health` handlers now run inside
   the development server; a frontend-only server is no longer sufficient or needed.

Firebase remains the shared database, token issuer and media storage. Users do not
connect a Google account. Existing collection names, profile IDs, the named database
and storage paths are preserved; the rebuild does not migrate or erase existing data.

## Authentication and access

Initial PIN hashes are server-only `PIN_BOAZ_HASH` and `PIN_MISHEL_HASH`, formatted as
`base64(salt):base64(scrypt(pin, salt, 64))`. Keep leading zeroes in PINs.
`server/pin.ts` provides hashing and constant-time verification.

Changed PINs are hashed in `private_pin_codes/{profile}`. Rate limits are reserved
transactionally in `private_pin_attempts/{hashed-ip}`: five attempts per IP per
15 minutes, including successful attempts. These collections are accessible only
through the Admin SDK; the client rules have no grants for them. An optional Firestore
TTL policy on `private_pin_attempts.expiresAt` can remove old attempt records.

The vault screen requires two additional codes, verified sequentially by `/api/vault-access`.
The first-step challenge is signed, bound to the authenticated profile and expires
after five minutes. Code verifiers are server-only. Leaving the vault or pressing
its lock button requires both codes again. This screen gate does not change the
existing Firebase member authorization rules or revoke previously shared media URLs.
View-once controls are application behavior, not screenshot prevention or end-to-end encryption.

## Hosting

The existing Vercel project is linked in `.vercel`. It builds with `npm run build`
and serves `dist` plus the server handlers. Configure the same three server variables
for the intended environment. Deploy the existing `firestore.rules` and `storage.rules`
to the configured named database and bucket when needed.

The public production domain must reach the app's PIN screen without a second
Vercel login. Keep preview deployments protected. Do not disable protection merely
for testing: use `vercel curl` to inspect protected deployments.

## Validation

- `npm test` — authentication, PIN limits, sync recovery, chat drafts, mission points,
  vault failure recovery, and concurrent game writes.
- `npm run lint` — TypeScript validation.
- `npm run build` — production bundle.

See `REBUILD-STATUS.md` for the exact external blockers and unverified live flows.
