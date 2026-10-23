"use client";

// Staff: the one deposit address customers see for each coin. Add or change it with Save, take it down with Remove.
// Used on the Customers page and the Deposits & withdrawals page.
import { useEffect, useState } from "react";
import { when } from "./shared";
import { addressProblem, ASSETS, type Asset, type DepositAddress } from "@/lib/funding";

async function put(base: string, asset: Asset, address: string): Promise<DepositAddress[]> {
  const res = await fetch(`${base}/api/funding`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset, address }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data.addresses;
}

function AddressRow({ asset, network, current, base, onSaved }: { asset: Asset; network: string; current?: DepositAddress; base: string; onSaved: (a: DepositAddress[]) => void }) {
  const [value, setValue] = useState(current?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  useEffect(() => setValue(current?.address ?? ""), [current?.address]);
  const dirty = value.trim() !== (current?.address ?? "");

  async function apply(address: string, done: string) {
    setBusy(true); setMsg(null);
    try {
      onSaved(await put(base, asset, address));
      setMsg({ bad: false, text: done });
    } catch (err) {
      setMsg({ bad: true, text: (err as Error).message });
    } finally { setBusy(false); }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) { setMsg({ bad: true, text: `Enter the ${asset} address, or use Remove to take it down.` }); return; }
    const problem = addressProblem(asset, value);
    if (problem) { setMsg({ bad: true, text: problem }); return; }
    void apply(value.trim(), current ? "Address changed. Customers see the new one now." : "Address added. Customers can deposit now.");
  }

  function remove() {
    if (!confirm(`Remove the ${asset} deposit address? Customers won't be able to deposit ${asset} until you add one again.`)) return;
    void apply("", `${asset} address removed. ${asset} deposits are off.`);
  }

  return (
    <form className="adm-addr" onSubmit={save} noValidate>
      <div className="adm-addr-head">
        <b>{asset}</b><span className="muted small">{network}</span>
        <span className={`pill ${current ? "good" : ""}`}>{current ? "Live" : "No address"}</span>
      </div>
      <div className="adm-addr-row">
        <input className="input mono" value={value} onChange={(e) => setValue(e.target.value)} placeholder={asset === "BTC" ? "bc1…" : "0x…"} aria-label={`${asset} deposit address`} spellCheck={false} autoComplete="off" />
      </div>
      <div className="adm-addr-actions">
        <button className="btn small" type="submit" disabled={busy || !dirty}>{busy ? "Saving…" : current ? "Save" : "Add"}</button>
        {current && <button className="btn ghost small" type="button" disabled={busy} onClick={remove}>Remove</button>}
        {current && <span className="muted small">Updated {when(current.updatedAt)}</span>}
      </div>
      {msg && <span className={`hint ${msg.bad ? "bad" : ""}`} role="status">{msg.text}</span>}
    </form>
  );
}

export function DepositAddresses({ base, initial, onChange }: { base: string; initial: DepositAddress[]; onChange?: (a: DepositAddress[]) => void }) {
  const [addresses, setAddresses] = useState(initial);
  useEffect(() => setAddresses(initial), [initial]);
  const saved = (a: DepositAddress[]) => { setAddresses(a); onChange?.(a); };
  return (
    <section className="panel glass">
      <div className="sec-head"><h2>Deposit addresses</h2><span className="muted small">One per coin · customers see changes within seconds</span></div>
      <div className="adm-addrs">
        {ASSETS.map((a) => (
          <AddressRow key={a.asset} asset={a.asset} network={a.network} current={addresses.find((x) => x.asset === a.asset)} base={base} onSaved={saved} />
        ))}
      </div>
    </section>
  );
}
