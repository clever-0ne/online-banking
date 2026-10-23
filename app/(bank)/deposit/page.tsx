"use client";

import { useEffect, useRef, useState } from "react";
import { useBank } from "@/components/BankProvider";
import { FundingList } from "@/components/FundingList";
import { ICONS } from "@/components/nav";
import { AmountInput, PageHead, Tabs } from "@/components/ui";
import { copyText, useFunding } from "@/components/useFunding";
import { ASSETS, assetInfo, MIN_DEPOSIT, RAMP_URL, type Asset } from "@/lib/funding";
import { fmt, mask, parseAmount } from "@/lib/format";

export default function DepositPage() {
  const { state, act, toast } = useBank();
  const { addresses, requests, error: loadError, refresh } = useFunding();
  const [asset, setAsset] = useState<Asset>("BTC");
  const [card, setCard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [to, setTo] = useState<"chk" | "sav">("chk");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);

  const info = assetInfo(asset);
  const addr = addresses?.find((a) => a.asset === asset);
  const accounts = state.accounts.filter((a) => a.kind !== "credit");

  // If staff change the address while it's on screen, say so and make the customer copy it again.
  const shown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (shown.current && addr?.address !== shown.current) { setChanged(true); setCopied(false); }
    shown.current = addr?.address;
  }, [addr?.address]);
  useEffect(() => { shown.current = undefined; setChanged(false); setCopied(false); }, [asset]);

  async function copy() {
    if (!addr) return;
    const ok = await copyText(addr.address);
    setCopied(true); setChanged(false);
    toast(ok ? "Address copied" : "Couldn't copy automatically. Select the address and copy it");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = parseAmount(amount);
    if (!amount || !Number.isFinite(v) || v <= 0) { setError("Enter the amount you sent, in dollars."); return; }
    if (v < MIN_DEPOSIT) { setError(`The minimum deposit is ${fmt(MIN_DEPOSIT)}.`); return; }
    setBusy(true); setError("");
    try {
      await act("/api/funding/deposits", { asset, amount: v, reference, to });
      await refresh();
      setAmount(""); setReference("");
      toast("Deposit sent for approval");
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Deposit" sub="Add money to your account. Each deposit is checked by our team before it's added to your balance." />

      <section className="panel">
        <Tabs<Asset> label="Asset" value={asset} onChange={(a) => { setAsset(a); setCard(false); }} options={ASSETS.map((a) => [a.asset, a.asset])} />

        {addresses === null ? (
          <p className="empty">{loadError ? "Couldn't load deposit details. Check your connection." : "Loading…"}</p>
        ) : !addr ? (
          <p className="empty">{info.name} deposits aren&apos;t available right now. Try another option or check back later.</p>
        ) : (
          <div className="fund">
            <p className="muted">Send <b>{info.name} ({asset})</b> on the <b>{info.network}</b> network to:</p>
            <div className="addr-box">
              <code onCopy={() => { setCopied(true); setChanged(false); }}>{addr.address}</code>
              <button type="button" className="btn small" onClick={copy}>{ICONS.copy}{copied ? "Copied" : "Copy"}</button>
            </div>
            {changed && <p className="notice warn" role="status">This address was just updated. Copy the new one before you send anything.</p>}
            <p className="hint">Only send {asset} on {info.network}. Anything sent on another network or in another asset can&apos;t be recovered.</p>

            {!card ? (
              <button type="button" className="btn ghost" onClick={() => setCard(true)}>{ICONS.card}Deposit with card</button>
            ) : (
              <div className="card-buy">
                <b>Buy {asset} with a card</b>
                <ol className="steps">
                  <li className={copied ? "done" : ""}>
                    <span>Copy the deposit address above.</span>
                    {!copied && <button type="button" className="btn small" onClick={copy}>{ICONS.copy}Copy address</button>}
                  </li>
                  <li className={copied ? "" : "off"}>
                    <span>Open Ramp, create an account and verify your identity.</span>
                  </li>
                  <li className={copied ? "" : "off"}>
                    <span>Paste the address as the receiving wallet and buy {asset}. Then tell us below so we can add it to your balance.</span>
                  </li>
                </ol>
                {copied ? (
                  <a className="btn" href={RAMP_URL} target="_blank" rel="noopener noreferrer">Buy now</a>
                ) : (
                  <button type="button" className="btn" disabled>Buy now</button>
                )}
                <p className="hint">Ramp is a separate service. Its fees and identity checks apply.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {addr && (
        <section className="panel">
          <div className="panel-head"><h2>I&apos;ve sent a deposit</h2></div>
          <form className="form" onSubmit={submit} noValidate>
            <div className="row-2">
              <div className="field">
                <label htmlFor="dp-amount">Amount sent</label>
                <AmountInput id="dp-amount" value={amount} onChange={setAmount} />
              </div>
              <div className="field">
                <label htmlFor="dp-to">Add it to</label>
                <select className="input" id="dp-to" value={to} onChange={(e) => setTo(e.target.value as "chk" | "sav")}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} {mask(a.last4)}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="dp-ref">Transaction ID <span className="muted">(optional, helps us find it faster)</span></label>
              <input className="input mono" id="dp-ref" value={reference} maxLength={200} autoComplete="off" onChange={(e) => setReference(e.target.value)} />
            </div>
            {error && <p className="hint bad" role="alert">{error}</p>}
            <p className="hint">Your deposit shows as pending until our team approves it. Then it appears in your balance.</p>
            <div className="actions"><button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Submit for approval"}</button></div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Your deposits</h2></div>
        <FundingList items={requests} type="deposit" />
      </section>
    </>
  );
}
