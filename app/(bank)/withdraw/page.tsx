"use client";

import { useState } from "react";
import { useBank } from "@/components/BankProvider";
import { FundingList } from "@/components/FundingList";
import { AmountInput, PageHead, Tabs } from "@/components/ui";
import { useFunding } from "@/components/useFunding";
import { addressProblem, ASSETS, assetInfo, MIN_WITHDRAWAL, type Asset } from "@/lib/funding";
import { fmt, mask, parseAmount } from "@/lib/format";
import { available } from "@/lib/logic";

export default function WithdrawPage() {
  const { state, act, toast } = useBank();
  const { requests, refresh } = useFunding();
  const [asset, setAsset] = useState<Asset>("BTC");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<"chk" | "sav">("chk");
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const info = assetInfo(asset);
  const accounts = state.accounts.filter((a) => a.kind !== "credit");
  const left = available(state, from);
  const held = state.accounts.reduce((x, a) => x + (a.held ?? 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = parseAmount(amount);
    const problem = addressProblem(asset, address);
    if (problem) { setError({ field: "address", text: problem }); return; }
    if (!amount || !Number.isFinite(v) || v <= 0) { setError({ field: "amount", text: "Enter an amount greater than $0." }); return; }
    if (v < MIN_WITHDRAWAL) { setError({ field: "amount", text: `The minimum withdrawal is ${fmt(MIN_WITHDRAWAL)}.` }); return; }
    if (v > left) { setError({ field: "amount", text: `That's more than the ${fmt(left)} available.` }); return; }
    setBusy(true); setError(null);
    try {
      await act("/api/funding/withdrawals", { asset, address: address.trim(), amount: v, from });
      await refresh();
      setAmount(""); setAddress("");
      toast("Withdrawal sent for approval");
    } catch (err) {
      setError({ text: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Withdraw" sub="Send money from your account to your own wallet. Each withdrawal is checked by our team before it goes out." />

      <section className="panel">
        <form className="form" onSubmit={submit} noValidate>
          <Tabs<Asset> label="Receive as" value={asset} onChange={(a) => { setAsset(a); setError(null); }} options={ASSETS.map((a) => [a.asset, a.asset])} />
          <div className="field">
            <label htmlFor="wd-addr">Your {asset} wallet address</label>
            <input className="input mono" id="wd-addr" value={address} autoComplete="off" spellCheck={false} placeholder={asset === "BTC" ? "bc1…" : "0x…"}
              aria-invalid={error?.field === "address"} onChange={(e) => setAddress(e.target.value)} />
            <span className="hint">On the {info.network} network. Check it carefully: money sent to a wrong address can&apos;t be recovered.</span>
          </div>
          <div className="row-2">
            <div className="field">
              <label htmlFor="wd-from">From</label>
              <select className="input" id="wd-from" value={from} onChange={(e) => setFrom(e.target.value as "chk" | "sav")}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} {mask(a.last4)}</option>)}
              </select>
              <span className="hint">{fmt(left)} available</span>
            </div>
            <div className="field">
              <label htmlFor="wd-amount">Amount</label>
              <AmountInput id="wd-amount" value={amount} onChange={setAmount} />
            </div>
          </div>
          {error && <p className="hint bad" role="alert">{error.text}</p>}
          <p className="hint">The amount is held from your balance while it&apos;s pending. If it&apos;s declined, the hold is released.</p>
          <div className="actions"><button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Submit for approval"}</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Your withdrawals</h2>{held > 0 && <span className="muted small">{fmt(held)} on hold</span>}</div>
        <FundingList items={requests} type="withdrawal" />
      </section>
    </>
  );
}
