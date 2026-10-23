# Anchor Bank

An online banking website built with Next.js 16 (App Router, TypeScript), with the features of a large U.S. retail bank, a Postgres database, passkey sign-in and a separate staff console.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000 and open an account at `/signup`. New accounts start with $0 balances and no activity.

## Environment

| Variable | What it's for |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (for example from Neon). Required. Tables are created on first run. |
| `APP_ORIGIN` | The site's public address, e.g. `https://anchorbank.com`. Passkeys are tied to it, so set it in production and don't change it afterwards. Leave unset for localhost. |
| `ADMIN_PATH` | The hidden address of the staff console, e.g. `/ops-3f9a1c7e2b4d`. At least 6 letters, numbers, `-` or `_` after the slash. Without it the console is switched off. |
| `ADMIN_PASSWORD` | The staff password. Staff sign in with this alone (no username). Use a long, unique one in production. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Push notification keys. Generate a pair with `npx web-push generate-vapid-keys`. Changing them turns off notifications on every device until people turn them back on. |
| `VAPID_SUBJECT` | A contact address for push services: `mailto:you@yourbank.com` or your site's `https://` address. |
| `RESEND_API_KEY` | Resend API key for email. Without it, no emails are sent and "Forgot password" is unavailable. |
| `EMAIL_FROM` | The sender, on a domain verified in Resend, e.g. `Anchor Bank <no-reply@yourbank.com>`. |
| `STAFF_EMAIL` | Optional. Staff inbox for new deposits and withdrawals to review. |
| `AUTH_SECRET` | 32+ random characters used to sign session cookies. If unset, a random key is created in `.data/secret`. |

Changing `ADMIN_PASSWORD` signs out every staff session.

## Staff console

The console has its own sign-in at `<ADMIN_PATH>/login` (password only) and no sign-up. Customers can't tell it exists: it isn't linked anywhere, `/admin` returns 404, its pages are `noindex`, its APIs answer 404 to anyone without a staff session, and its code and styles (`app/admin/admin.css`) load only under the hidden path, so nothing a customer's browser downloads mentions it. Staff and customer sign-ins use separate cookies and never grant each other access.

| Route | What it does |
| --- | --- |
| `<ADMIN_PATH>/login` | Staff sign-in |
| `<ADMIN_PATH>` | Stats, sign-ups, searchable customer list, activity log |
| `<ADMIN_PATH>/users/[id]` | One customer: manage, edit, balances, transactions, page access, activity |
| `<ADMIN_PATH>/funding` | Deposit addresses, and deposits and withdrawals to approve or decline |

On a customer's page staff can:

- **Suspend or reactivate**: suspended customers are signed out at once and can't sign in.
- **Sign out everywhere**: ends every session on every device.
- **Reset password**: creates a one-time temporary password, shown once, and signs them out.
- **Page access**: switch individual pages off or on. A switched-off page disappears from their menu and dashboard shortcuts, opening it shows "Access denied" (403), and its payment endpoint refuses requests. Changes apply on their next request.
- **Remove passkeys**: for a customer who lost their device, after confirming who they are. They sign in with their password and can add a new passkey.
- **Reset banking data**: empties their accounts back to $0.
- **Edit details** and a **staff-only note** (never sent to the customer).
- **Delete the account**: you type the email to confirm; their banking data goes with it.

## Customer pages

| Route | Who can see it | What it does |
| --- | --- | --- |
| `/` | Everyone | Landing page |
| `/login`, `/signup` | Signed-out visitors | Sign in (with "keep me signed in") or open an account |
| `/dashboard` | Signed in | Balance card, actions, quick transfer, monthly stats and charts, budgets, upcoming payments, goals, credit score |
| `/activity`, `/statements` | Signed in | Transactions with filters; monthly statements with CSV download |
| `/transfer`, `/send`, `/bills` | Signed in | Transfers and card payments, send/request money, bill pay |
| `/deposit`, `/withdraw` | Signed in | Deposit to the address staff publish (or buy with a card through Ramp), and withdraw to your own wallet. Both wait for staff approval. |
| `/budget`, `/goals`, `/credit` | Signed in | Budgets, savings goals, credit score |
| `/cards`, `/alerts`, `/profile` | Signed in | Card controls, alerts, profile and security settings |

## Deposits and withdrawals

Both use BTC, ETH (Ethereum) or USDC (Ethereum, ERC-20) addresses.

- **Deposit addresses** are set by staff on the Deposits & withdrawals page, one per asset. Customers' Deposit pages pick up a change within seconds; an empty address turns that asset off.
- **Deposit**: the customer copies the address and sends funds, or taps **Deposit with card**: copy the address, then **Buy now** opens Ramp Network, where they open an account, verify their identity, paste the address and buy. They then report the deposit (amount in dollars, optional transaction ID). It shows as *Pending approval* until staff approve it, which credits their account, or decline it.
- **Withdraw**: the customer enters their own wallet address and an amount. The amount is held from their balance at once, so it can't be spent twice. Staff send the funds themselves, then approve (the ledger is debited) or decline (the hold is released).
- Customers see each decision, and their new balance, within seconds.

Nothing moves funds on a blockchain automatically: staff check incoming deposits and send withdrawals from the bank's own wallet.

## Push notifications

Customers turn them on per device in Profile → Preferences → **Notifications on this device**. They're told about deposits and withdrawals being approved or declined, new sign-ins (if **Sign-in alerts** is on), password changes and passkeys being added or removed. Signing out turns that device off.

Staff turn them on under Deposits & withdrawals → **Notify me on this device**, and hear about every new deposit and withdrawal to review. Notification text never includes customer names or full addresses.

On iPhone, notifications work once Anchor Bank is added to the Home Screen and opened from there (iOS 16.4 or later).

## Email

Sent through Resend from `EMAIL_FROM`, in one Anchor-branded layout (`lib/server/email.ts`). Customers get:

- a welcome email when they open an account
- every alert they'd get as a push notification: new sign-ins (if Sign-in alerts is on), password and passkey changes, deposits and withdrawals received, approved or declined, and confirmations for transfers, bill payments, Send money and savings-goal contributions, with the amount and status
- password reset links (`/forgot-password`): one-time, valid for 30 minutes, only a hash is stored, and the reply is the same whether or not the email has an account

Buttons in alert emails link to `APP_ORIGIN`, so set it on your host. With `STAFF_EMAIL` set, staff also get an email for each new deposit and withdrawal.

## Language and currency

The visitor's country comes from the host's location header (Vercel `x-vercel-ip-country`, Cloudflare `cf-ipcountry`, CloudFront) or, failing that, the region in their browser language (`app/api/locale`, `lib/locale.ts`).

- **Language:** pages are translated into that country's language with Google Translate (`components/AutoTranslate.tsx`). Page text is sent to Google to translate. The bank's name and account names are left as they are. English-speaking countries see the original.
- **Currency:** in the customer app, every amount is shown and typed in that country's currency, converted at the day's rate (open.er-api.com, cached 6 hours). Accounts are still held in US dollars: amounts typed are converted back to dollars before they're sent, and emails show dollars.
- Customers can switch to English or US dollars in Profile → Preferences (saved on that device).
- The staff console is never translated and always shows US dollars.

## Install as an app

Anchor Bank is a progressive web app: `app/manifest.ts`, icons in `public/`, and a service worker (`public/sw.js`, registered in production only) that keeps the app's static files and shows `public/offline.html` without a connection. Account pages and API responses are never cached on the device. Customers can install it from the menu (**Install Anchor app**) or Profile → Preferences → **Install the app**; on iPhone that shows the Add to Home Screen steps. The app icon, maskable icon, Apple touch icon and a monochrome notification badge are in `public/`.

## Database

Postgres at `DATABASE_URL`, through `pg`. Missing tables are created on first run:

- `users`: name, email, phone, scrypt password hash, status (`active` or `suspended`), session version, staff note, sign-in stats
- `bank_accounts`, `ledger`, `scheduled_payments`: accounts, the append-only ledger balances are summed from, and future-dated payments
- `bank_state`: each customer's settings (profile, payees, budgets, card controls) as JSON
- `user_page_access`: pages staff have switched off or on per customer (no row means on)
- `passkeys`: each customer's passkeys (WebAuthn public keys, never private keys)
- `push_subscriptions`: devices that receive notifications (a customer's, or staff)
- `deposit_addresses`, `crypto_deposits`, `crypto_withdrawals`: deposit addresses staff publish, and deposit and withdrawal requests with their review
- `audit_log`: every sign-up, sign-in and staff action, with who did it and when

Each payment runs in one transaction that holds a lock for that customer, so two requests can't spend the same balance.

## Security

- **Passwords** are hashed with scrypt and a per-user salt. Unknown emails take the same time to check as known ones. Changing your password signs out your other devices.
- **2-step verification is passkeys only** (no text or app codes). A customer who adds a passkey in Profile → Security must use it after their password at every sign-in. Removing a passkey needs the password.
- **Customer sessions** are an HMAC-signed, httpOnly, SameSite=Lax cookie: 12 hours, or 30 days with "keep me signed in".
- **Staff sessions** are a separate signed cookie (SameSite=Strict, 8 hours) tied to the current `ADMIN_PASSWORD`.
- **Session versions**: suspending, resetting a password or "sign out everywhere" ends every existing session at once.
- **Route protection** happens twice: `proxy.ts` redirects signed-out requests, and the server layouts and every API verify the session again.
- **Login throttling**: 5 wrong passwords per email (or staff) and IP lock sign-in for 60 seconds.
- **Cross-site requests**: every state-changing endpoint rejects requests whose `Origin` isn't this site.

For production, serve over HTTPS (cookies are `Secure` in production) and set `APP_ORIGIN`.

## How it works

- `proxy.ts`: route protection and the hidden staff path (rewritten internally to `app/admin`)
- `lib/server/db.ts`: Postgres pool, schema, `all`/`one`/`run` queries and `tx` transactions
- `lib/server/users.ts`, `session.ts`, `current.ts`, `http.ts`: accounts, signed sessions, the signed-in customer, auth helpers
- `lib/server/adminAuth.ts`: staff credentials, cookie and guard
- `lib/server/passkeys.ts`, `app/api/auth/passkey`, `app/api/passkeys`: passkey sign-in step and managing passkeys
- `lib/server/push.ts`, `lib/server/pushRoute.ts`, `app/api/push`, `<ADMIN_PATH>/api/push`, `components/pwa.ts`, `public/sw.js`: push notifications, install prompt, service worker
- `lib/funding.ts`, `lib/server/funding.ts`, `app/api/funding`, `app/admin/api/funding`: deposits, withdrawals and their approval
- `lib/pages.ts`, `lib/server/permissions.ts`: the pages staff can switch off per customer, and the checks
- `lib/server/admin.ts`: customer search, stats, staff actions and the activity log
- `app/api/auth/*`: `signup`, `login`, `passkey`, `password`, `logout`, `me`
- `app/api/bank`: load and save the signed-in customer's banking data
- `app/admin/api/session`, `app/admin/api/users`, `app/admin/api/users/[id]`: staff sign-in, customer list, detail, actions and delete
- `app/admin`, `components/admin/*`: staff console
- `lib/types.ts`, `lib/seed.ts`, `lib/logic.ts`, `lib/format.ts`: data model, new-account state, banking rules, formatting
- `components/BankProvider.tsx`: loads and saves banking data, loading screen

## Before taking real customers

Balances live in this app's own database and are changed by the browser, and no money moves to or from other banks. Holding real customer money needs a server-side ledger, a core banking or banking-as-a-service provider, payment rails (ACH, card networks, a person-to-person network), identity verification (KYC), fraud monitoring, and the bank charter or partner bank and compliance programs that come with it.
