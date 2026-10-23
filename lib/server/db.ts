// Postgres (DATABASE_URL, e.g. Neon). One connection pool per server process, reused across hot reloads.
// Queries use "?" placeholders, turned into $1, $2… here. Inside tx(), every query runs on the transaction's connection.
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, types, type PoolClient } from "pg";

// Whole cents and counts come back as JS numbers (they stay far below 2^53).
types.setTypeParser(20, (v) => Number(v)); // bigint
types.setTypeParser(1700, (v) => Number(v)); // numeric, e.g. SUM of bigint

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT NOT NULL DEFAULT '',
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  session_version INTEGER NOT NULL DEFAULT 1,
  note            TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  last_login_at   TEXT,
  login_count     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS users_created ON users (created_at);

CREATE TABLE IF NOT EXISTS bank_state (
  user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  at           TEXT NOT NULL,
  actor_id     TEXT,
  actor_email  TEXT,
  action       TEXT NOT NULL,
  target_id    TEXT,
  target_email TEXT,
  detail       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS audit_target ON audit_log (target_id, at);

-- Pages staff have switched on or off for one customer. No row means the page is on.
CREATE TABLE IF NOT EXISTS user_page_access (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  page       TEXT NOT NULL,
  enabled    INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  PRIMARY KEY (user_id, page)
);

-- Passkeys (WebAuthn), the second step at sign-in. public_key is base64url COSE.
CREATE TABLE IF NOT EXISTS passkeys (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  counter       BIGINT NOT NULL DEFAULT 0,
  transports    TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT 'Passkey',
  created_at    TEXT NOT NULL,
  last_used_at  TEXT
);
CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys (user_id);

-- Each customer's checking, savings and credit card. Balances aren't stored: they're the sum of the ledger.
CREATE TABLE IF NOT EXISTS bank_accounts (
  user_id            TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  id                 TEXT NOT NULL CHECK (id IN ('chk', 'sav', 'cc')),
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('checking', 'savings', 'credit')),
  last4              TEXT NOT NULL,
  credit_limit_cents INTEGER NOT NULL DEFAULT 0,
  apy                DOUBLE PRECISION,
  opened_at          TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

-- Every movement of money, in whole cents. Rows are never changed or removed while the customer exists;
-- corrections are new rows. An entry counts toward the posted balance from its available_on date.
CREATE TABLE IF NOT EXISTS ledger (
  seq          BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  acct         TEXT NOT NULL CHECK (acct IN ('chk', 'sav', 'cc')),
  date         TEXT NOT NULL,
  available_on TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents <> 0),
  payee        TEXT NOT NULL,
  cat          TEXT NOT NULL,
  memo         TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL,
  handle       TEXT,
  goal_id      TEXT,
  ref          TEXT,
  created_at   TEXT NOT NULL,
  created_by   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user ON ledger (user_id, acct, available_on);

-- The ledger is append-only. Deleting the customer removes their rows (the cascade runs after the user row is gone).
CREATE OR REPLACE FUNCTION ledger_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'The ledger is append-only.';
END $$;
DROP TRIGGER IF EXISTS ledger_no_update ON ledger;
DROP TRIGGER IF EXISTS ledger_append_only ON ledger;
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON ledger FOR EACH ROW EXECUTE FUNCTION ledger_append_only();

-- Future-dated and repeating payments. The server runs them on their date.
CREATE TABLE IF NOT EXISTS scheduled_payments (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('transfer', 'ach', 'bill')),
  from_acct    TEXT NOT NULL CHECK (from_acct IN ('chk', 'sav')),
  to_ref       TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  date         TEXT NOT NULL,
  repeat       TEXT NOT NULL CHECK (repeat IN ('once', 'weekly', 'monthly')),
  memo         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scheduled_due ON scheduled_payments (user_id, date);

-- The address customers deposit to, one per asset, set by staff.
CREATE TABLE IF NOT EXISTS deposit_addresses (
  asset      TEXT PRIMARY KEY CHECK (asset IN ('BTC', 'ETH', 'USDC')),
  network    TEXT NOT NULL,
  address    TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- Deposits customers report. Money reaches their account only when staff approve.
CREATE TABLE IF NOT EXISTS crypto_deposits (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset        TEXT NOT NULL CHECK (asset IN ('BTC', 'ETH', 'USDC')),
  address      TEXT NOT NULL,
  tx_hash      TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status       TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at  TEXT,
  reviewed_by  TEXT,
  created_at   TEXT NOT NULL
);
ALTER TABLE crypto_deposits ADD COLUMN IF NOT EXISTS to_acct TEXT NOT NULL DEFAULT 'chk';
CREATE INDEX IF NOT EXISTS deposits_user ON crypto_deposits (user_id, created_at);
CREATE INDEX IF NOT EXISTS deposits_status ON crypto_deposits (status, created_at);

-- Withdrawals customers ask for. The amount is held from their balance until staff send it (sent) or decline it (failed).
CREATE TABLE IF NOT EXISTS crypto_withdrawals (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset        TEXT NOT NULL CHECK (asset IN ('BTC', 'ETH', 'USDC')),
  address      TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status       TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  tx_ref       TEXT,
  created_at   TEXT NOT NULL,
  reviewed_at  TEXT,
  reviewed_by  TEXT
);
ALTER TABLE crypto_withdrawals ADD COLUMN IF NOT EXISTS from_acct TEXT NOT NULL DEFAULT 'chk';
CREATE INDEX IF NOT EXISTS withdrawals_user ON crypto_withdrawals (user_id, created_at);

-- Devices that receive push notifications. A customer's (user_id set) or staff (audience 'staff', no user).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint     TEXT PRIMARY KEY,
  audience     TEXT NOT NULL CHECK (audience IN ('customer', 'staff')),
  user_id      TEXT REFERENCES users (id) ON DELETE CASCADE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  device       TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  last_sent_at TEXT,
  CHECK ((audience = 'customer') = (user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS push_user ON push_subscriptions (user_id);

-- One-time password reset links sent by email. Only a hash of the token is stored.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets (user_id);
`;

function makePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL isn't set. Add your Postgres connection string to .env.local.");
  // "require" already verifies the certificate in this driver; saying so explicitly avoids its warning.
  return new Pool({ connectionString: url.replace(/sslmode=require\b/, "sslmode=verify-full"), max: 10, idleTimeoutMillis: 30_000 });
}

const g = globalThis as unknown as { __anchorPool?: Pool; __anchorReady?: Promise<void>; __anchorSchema?: string };
const pool = () => (g.__anchorPool ??= makePool());

/** Creates any missing tables once per server process, and again if the schema changes during development. */
function ready(): Promise<void> {
  if (g.__anchorSchema !== SCHEMA) { g.__anchorSchema = SCHEMA; g.__anchorReady = undefined; }
  return (g.__anchorReady ??= pool().query(SCHEMA).then(
    () => undefined,
    (e) => { g.__anchorReady = undefined; throw e; },
  ));
}

const txClient = new AsyncLocalStorage<PoolClient>();
const toPg = (sql: string) => { let i = 0; return sql.replace(/\?/g, () => "$" + ++i); };

async function exec(sql: string, args: unknown[]) {
  await ready();
  return (txClient.getStore() ?? pool()).query(toPg(sql), args);
}

/** Every row. */
export const all = async <T>(sql: string, ...args: unknown[]) => (await exec(sql, args)).rows as T[];
/** The first row, or undefined. */
export const one = async <T>(sql: string, ...args: unknown[]) => (await exec(sql, args)).rows[0] as T | undefined;
/** Runs a statement and returns how many rows it changed. */
export const run = async (sql: string, ...args: unknown[]) => (await exec(sql, args)).rowCount ?? 0;

/**
 * Runs fn in one transaction. With a lock key (a customer id), transactions for the same key run one at a time,
 * so two payments can't both spend the same balance. Nested calls join the outer transaction.
 */
export async function tx<T>(fn: () => Promise<T>, lockKey?: string): Promise<T> {
  const lock = () => lockKey ? exec("SELECT pg_advisory_xact_lock(hashtext(?))", [lockKey]) : null;
  if (txClient.getStore()) { await lock(); return fn(); }
  await ready();
  const client = await pool().connect();
  try {
    return await txClient.run(client, async () => {
      await client.query("BEGIN");
      await lock();
      const result = await fn();
      await client.query("COMMIT");
      return result;
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
