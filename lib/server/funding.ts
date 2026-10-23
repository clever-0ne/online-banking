// Deposits and withdrawals: staff-published deposit addresses, customer requests, and staff approval.
// Nothing moves money until staff approve. A withdrawal's amount is held from the customer's balance
// while it waits, so it can't be spent twice. Server only.
import { randomUUID } from "node:crypto";
import { audit, type Actor } from "./admin";
import { BankError, ensureOpen, postEntry, spendableCents } from "./bank";
import { adminPath } from "./adminAuth";
import { all, one, run, tx } from "./db";
import { notifyCustomer, notifyStaff } from "./push";
import { addressProblem, ASSETS, assetInfo, isAsset, MIN_DEPOSIT, MIN_WITHDRAWAL, type Asset, type DepositAddress, type FundingRequest } from "@/lib/funding";
import { fmt, todayISO } from "@/lib/format";

// ---------- Deposit addresses ----------
type AddressRow = { asset: Asset; network: string; address: string; updated_at: string };

export async function depositAddresses(): Promise<DepositAddress[]> {
  const rows = await all<AddressRow>("SELECT asset, network, address, updated_at FROM deposit_addresses");
  return ASSETS.flatMap((a) => {
    const r = rows.find((x) => x.asset === a.asset);
    return r && r.address ? [{ asset: a.asset, network: r.network, address: r.address, updatedAt: r.updated_at }] : [];
  });
}

/** Sets or clears (empty address) the deposit address for one asset. */
export async function setDepositAddress(actor: Actor, asset: unknown, address: unknown) {
  if (!isAsset(asset)) throw new BankError("Choose BTC, ETH or USDC.");
  const a = String(address ?? "").trim();
  if (!a) {
    await run("DELETE FROM deposit_addresses WHERE asset = ?", asset);
    await audit(actor, "deposit_address_removed", null, asset);
    return;
  }
  const problem = addressProblem(asset, a);
  if (problem) throw new BankError(problem, 400, "address");
  await run(
    `INSERT INTO deposit_addresses (asset, network, address, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (asset) DO UPDATE SET network = excluded.network, address = excluded.address, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    asset, assetInfo(asset).network, a, new Date().toISOString(), actor.email,
  );
  await audit(actor, "deposit_address_set", null, `${asset}: ${a}`);
}

// ---------- Requests ----------
const acctName = (a: "chk" | "sav") => (a === "sav" ? "Savings" : "Checking");
const shortAddr = (addr: string) => (addr.length > 18 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr);
type DepositRow = { id: string; user_id: string; asset: Asset; address: string; tx_hash: string; amount_cents: number; status: "pending" | "approved" | "rejected"; to_acct: "chk" | "sav"; created_at: string; reviewed_at: string | null; reviewed_by: string | null };
type WithdrawalRow = { id: string; user_id: string; asset: Asset; address: string; amount_cents: number; status: "pending" | "sent" | "failed"; tx_ref: string | null; from_acct: "chk" | "sav"; created_at: string; reviewed_at: string | null; reviewed_by: string | null };

const fromDeposit = (r: DepositRow): FundingRequest => ({
  id: r.id, type: "deposit", asset: r.asset, address: r.address, amount: r.amount_cents / 100, account: r.to_acct, reference: r.tx_hash,
  status: r.status === "rejected" ? "declined" : r.status, createdAt: r.created_at, reviewedAt: r.reviewed_at,
});
const fromWithdrawal = (r: WithdrawalRow): FundingRequest => ({
  id: r.id, type: "withdrawal", asset: r.asset, address: r.address, amount: r.amount_cents / 100, account: r.from_acct, reference: r.tx_ref ?? "",
  status: r.status === "sent" ? "approved" : r.status === "failed" ? "declined" : "pending", createdAt: r.created_at, reviewedAt: r.reviewed_at,
});

/** The customer's own deposits and withdrawals, newest first. */
export async function myRequests(userId: string): Promise<FundingRequest[]> {
  const [d, w] = await Promise.all([
    all<DepositRow>("SELECT * FROM crypto_deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", userId),
    all<WithdrawalRow>("SELECT * FROM crypto_withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", userId),
  ]);
  return [...d.map(fromDeposit), ...w.map(fromWithdrawal)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const cents = (v: unknown, min: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) throw new BankError("Enter an amount greater than $0.", 400, "amount");
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new BankError("Amounts can have at most two decimal places.", 400, "amount");
  if (n < min) throw new BankError(`The minimum is ${fmt(min)}.`, 400, "amount");
  if (n > 1_000_000) throw new BankError("That's over the $1,000,000 limit for one request.", 400, "amount");
  return Math.round(n * 100);
};
const acctOf = (v: unknown): "chk" | "sav" => (v === "sav" ? "sav" : "chk");

type Owner = { id: string; name: string; email: string; phone: string; createdAt: string };

/** The customer tells us they've sent a deposit. It stays pending until staff approve it. */
export async function requestDeposit(user: Owner, body: Record<string, unknown>) {
  const asset = body.asset;
  if (!isAsset(asset)) throw new BankError("Choose which asset you sent.", 400, "asset");
  const addr = (await depositAddresses()).find((a) => a.asset === asset);
  if (!addr) throw new BankError(`${asset} deposits aren't available right now.`, 400, "asset");
  const amount = cents(body.amount, MIN_DEPOSIT);
  const ref = String(body.reference ?? "").trim().slice(0, 200);
  await ensureOpen(user);
  const open = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM crypto_deposits WHERE user_id = ? AND status = 'pending'", user.id))!.n;
  if (open >= 10) throw new BankError("You have 10 deposits waiting for approval. Wait for those to be reviewed first.");
  await run(
    "INSERT INTO crypto_deposits (id, user_id, asset, address, tx_hash, amount_cents, status, to_acct, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
    "dep_" + randomUUID(), user.id, asset, addr.address, ref, amount, acctOf(body.to), new Date().toISOString(),
  );
  await audit(user, "deposit_requested", user, `${fmt(amount / 100)} in ${asset}`);
  await notifyCustomer(user.id, {
    title: "We received your deposit", body: `Your ${fmt(amount / 100)} ${asset} deposit is waiting for approval. We'll let you know as soon as it's in your account.`, url: "/deposit", tag: "funding",
    email: { details: [["Amount", fmt(amount / 100)], ["Asset", asset], ["Account", acctName(acctOf(body.to))], ["Status", "Pending approval"], ...(ref ? [["Transaction ID", ref.slice(0, 40)] as [string, string]] : [])], button: { label: "View your deposits", href: "/deposit" } },
  });
  await notifyStaff({ title: "New deposit to review", body: `${fmt(amount / 100)} in ${asset}`, url: `${adminPath() ?? ""}/funding`, tag: "queue" });
}

/** The customer asks to withdraw to their own wallet. The amount is held until staff send or decline it. */
export async function requestWithdrawal(user: Owner, body: Record<string, unknown>) {
  const asset = body.asset;
  if (!isAsset(asset)) throw new BankError("Choose which asset to receive.", 400, "asset");
  const address = String(body.address ?? "").trim();
  const problem = addressProblem(asset, address);
  if (problem) throw new BankError(problem, 400, "address");
  const amount = cents(body.amount, MIN_WITHDRAWAL);
  const from = acctOf(body.from);
  await ensureOpen(user);
  await tx(async () => {
    const left = await spendableCents(user.id, from);
    if (amount > left) throw new BankError(`That's more than the ${fmt(Math.max(0, left) / 100)} available.`, 400, "amount");
    await run(
      "INSERT INTO crypto_withdrawals (id, user_id, asset, address, amount_cents, status, from_acct, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
      "wd_" + randomUUID(), user.id, asset, address, amount, from, new Date().toISOString(),
    );
  }, user.id);
  await audit(user, "withdrawal_requested", user, `${fmt(amount / 100)} in ${asset}`);
  await notifyCustomer(user.id, {
    title: "We received your withdrawal request", body: `${fmt(amount / 100)} is on hold from your ${acctName(from).toLowerCase()} while we review your ${asset} withdrawal. If it's declined, the hold is released.`, url: "/withdraw", tag: "funding",
    email: { details: [["Amount", fmt(amount / 100)], ["Asset", asset], ["To wallet", shortAddr(address)], ["From", acctName(from)], ["Status", "Pending approval"]], button: { label: "View your withdrawals", href: "/withdraw" } },
  });
  await notifyStaff({ title: "New withdrawal to review", body: `${fmt(amount / 100)} in ${asset}`, url: `${adminPath() ?? ""}/funding`, tag: "queue" });
}

// ---------- Staff review ----------
export interface QueueItem extends FundingRequest { userId: string; customer: string; email: string; reviewedBy: string | null }

export async function fundingQueue(): Promise<{ pending: QueueItem[]; recent: QueueItem[] }> {
  const [deps, wds] = await Promise.all([
    all<DepositRow & { name: string; email: string }>("SELECT d.*, u.name, u.email FROM crypto_deposits d JOIN users u ON u.id = d.user_id ORDER BY d.created_at DESC LIMIT 200"),
    all<WithdrawalRow & { name: string; email: string }>("SELECT w.*, u.name, u.email FROM crypto_withdrawals w JOIN users u ON u.id = w.user_id ORDER BY w.created_at DESC LIMIT 200"),
  ]);
  const items: QueueItem[] = [
    ...deps.map((r) => ({ ...fromDeposit(r), userId: r.user_id, customer: r.name, email: r.email, reviewedBy: r.reviewed_by })),
    ...wds.map((r) => ({ ...fromWithdrawal(r), userId: r.user_id, customer: r.name, email: r.email, reviewedBy: r.reviewed_by })),
  ];
  return {
    pending: items.filter((i) => i.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    recent: items.filter((i) => i.status !== "pending").sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? "")).slice(0, 40),
  };
}

/** Approves or declines one request. Approving a deposit credits the account; approving a withdrawal debits it. */
export async function review(actor: Actor, type: "deposit" | "withdrawal", id: string, decision: "approve" | "decline", reference = "") {
  const now = new Date().toISOString(), today = todayISO();
  if (type === "deposit") {
    const d = await one<DepositRow & { email: string }>("SELECT d.*, u.email FROM crypto_deposits d JOIN users u ON u.id = d.user_id WHERE d.id = ?", id);
    if (!d) throw new BankError("That request no longer exists.", 404);
    await tx(async () => {
      const changed = await run("UPDATE crypto_deposits SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ? AND status = 'pending'",
        decision === "approve" ? "approved" : "rejected", now, actor.email, id);
      if (!changed) throw new BankError("Someone already reviewed this request.", 409);
      if (decision === "approve") {
        await postEntry(d.user_id, { acct: d.to_acct, date: today, availableOn: today, amountCents: d.amount_cents, payee: `Deposit · ${d.asset}`, cat: "Income", memo: d.tx_hash ? `Ref ${d.tx_hash.slice(0, 60)}` : "Approved deposit", kind: "deposit" }, "staff:" + actor.email);
      }
    }, d.user_id);
    await audit(actor, decision === "approve" ? "deposit_approved" : "deposit_declined", { id: d.user_id, email: d.email }, `${fmt(d.amount_cents / 100)} in ${d.asset}`);
    await notifyCustomer(d.user_id, decision === "approve"
      ? { title: "Deposit approved", body: `${fmt(d.amount_cents / 100)} from your ${d.asset} deposit is now in your ${d.to_acct === "sav" ? "savings" : "checking"}.`, url: "/deposit", tag: "funding",
          email: { details: [["Amount", fmt(d.amount_cents / 100)], ["Asset", d.asset], ["Added to", acctName(d.to_acct)], ["Status", "Approved"]], button: { label: "See your balance", href: "/dashboard" } } }
      : { title: "Deposit declined", body: `Your ${fmt(d.amount_cents / 100)} ${d.asset} deposit couldn't be confirmed. Contact us if you have questions.`, url: "/deposit", tag: "funding",
          email: { details: [["Amount", fmt(d.amount_cents / 100)], ["Asset", d.asset], ["Status", "Declined"]] } });
    return;
  }
  const w = await one<WithdrawalRow & { email: string }>("SELECT w.*, u.email FROM crypto_withdrawals w JOIN users u ON u.id = w.user_id WHERE w.id = ?", id);
  if (!w) throw new BankError("That request no longer exists.", 404);
  await tx(async () => {
    const changed = await run("UPDATE crypto_withdrawals SET status = ?, tx_ref = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ? AND status = 'pending'",
      decision === "approve" ? "sent" : "failed", reference.trim().slice(0, 200) || null, now, actor.email, id);
    if (!changed) throw new BankError("Someone already reviewed this request.", 409);
    if (decision === "approve") {
      await postEntry(w.user_id, { acct: w.from_acct, date: today, availableOn: today, amountCents: -w.amount_cents, payee: `Withdrawal · ${w.asset}`, cat: "Transfers", memo: `To ${w.address.slice(0, 6)}…${w.address.slice(-4)}`, kind: "withdrawal" }, "staff:" + actor.email);
    }
  }, w.user_id);
  await audit(actor, decision === "approve" ? "withdrawal_approved" : "withdrawal_declined", { id: w.user_id, email: w.email }, `${fmt(w.amount_cents / 100)} in ${w.asset}`);
  await notifyCustomer(w.user_id, decision === "approve"
    ? { title: "Withdrawal sent", body: `${fmt(w.amount_cents / 100)} in ${w.asset} is on its way to your wallet.`, url: "/withdraw", tag: "funding",
        email: { details: [["Amount", fmt(w.amount_cents / 100)], ["Asset", w.asset], ["To wallet", shortAddr(w.address)], ...(reference.trim() ? [["Transaction ID", reference.trim().slice(0, 40)] as [string, string]] : []), ["Status", "Sent"]] } }
    : { title: "Withdrawal declined", body: `Your ${fmt(w.amount_cents / 100)} ${w.asset} withdrawal was declined and the money is available again.`, url: "/withdraw", tag: "funding",
        email: { details: [["Amount", fmt(w.amount_cents / 100)], ["Asset", w.asset], ["Status", "Declined · hold released"]] } });
}

