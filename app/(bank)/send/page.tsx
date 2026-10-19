"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useBank } from "@/components/BankProvider";
import { ICONS } from "@/components/nav";
import { Tabs } from "@/components/ui";
import { fmt, shortDate } from "@/lib/format";
import { available, formatPhone, handleKind, P2P_DAILY_LIMIT, requestMoney, sentToday } from "@/lib/logic";

type Mode = "send" | "request";
type Step = "pick" | "amount" | "receipt";
interface Who { name: string; handle: string }
interface Receipt { who: Who; amount: number; memo: string; id: string; at: Date; mode: Mode }

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

export default function SendPage() {
  const { state, update, act, toast } = useBank();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("send");
  const [step, setStep] = useState<Step>("pick");
  const [who, setWho] = useState<Who | null>(null);
  const [cents, setCents] = useState(""); // digits typed, ATM-style: "1250" = $12.50
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [newWho, setNewWho] = useState({ name: "", handle: "" });
  const [newError, setNewError] = useState("");
  const [addingNew, setAddingNew] = useState(false);

  // Home links here with ?to=<contact>, ?new=1 or ?mode=request.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "request") setMode("request");
    const c = state.contacts.find((x) => x.id === q.get("to"));
    if (c) { setWho({ name: c.name, handle: c.handle }); setStep("amount"); }
    if (q.get("new") === "1") setAddingNew(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = Number(cents || "0") / 100;
  const avail = available(state, "chk");
  const remaining = P2P_DAILY_LIMIT - sentToday(state);

  function press(k: string) {
    setError("");
    setCents((c) => {
      if (k === "del") return c.slice(0, -1);
      const next = (c + k).replace(/^0+/, "");
      return next.length > 7 ? c : next; // up to $99,999.99
    });
  }

  // Physical keyboard works on the amount step too.
  useEffect(() => {
    if (step !== "amount") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  function chooseNew(e: React.FormEvent) {
    e.preventDefault();
    const kind = handleKind(newWho.handle);
    const err = !newWho.name.trim() ? "Add the person's name." : !kind ? "Enter an email address or a 10-digit U.S. mobile number." : "";
    setNewError(err);
    if (err) return;
    setWho({ name: newWho.name.trim(), handle: kind === "phone" ? formatPhone(newWho.handle) : newWho.handle.trim() });
    setStep("amount");
  }

  async function submit() {
    if (!who) return;
    const err =
      value <= 0 ? "Enter an amount." :
      mode === "send" && value > avail ? `That's more than the ${fmt(avail)} available in checking.` :
      mode === "send" && value > remaining ? `You can send ${fmt(remaining)} more today. The daily limit is ${fmt(P2P_DAILY_LIMIT)}.` : "";
    setError(err);
    if (err) return;
    const p = { name: who.name, handle: who.handle, amount: value, memo: memo.trim() };
    if (mode === "send") {
      setBusy(true);
      try {
        await act("/api/bank/p2p", p);
      } catch (e) {
        setError((e as Error).message);
        return;
      } finally {
        setBusy(false);
      }
    } else {
      update((s) => requestMoney(s, p));
    }
    setReceipt({ who, amount: value, memo: memo.trim(), mode, at: new Date(), id: "ANC-" + Math.random().toString(36).slice(2, 9).toUpperCase() });
    setStep("receipt");
    toast(mode === "send" ? "Money sent" : "Request sent");
  }

  function receiptText(r: Receipt) {
    return `Anchor Bank receipt\n${r.mode === "send" ? "Sent" : "Requested"} ${fmt(r.amount)} ${r.mode === "send" ? "to" : "from"} ${r.who.name} (${r.who.handle})\n${r.at.toLocaleString("en-US")}\nTransaction ID ${r.id}${r.memo ? `\nNote: ${r.memo}` : ""}`;
  }
  async function share(r: Receipt) {
    const text = receiptText(r);
    try {
      if (navigator.share) { await navigator.share({ title: "Anchor receipt", text }); return; }
      await navigator.clipboard.writeText(text);
      toast("Receipt copied");
    } catch { /* share sheet closed */ }
  }
  async function copyId(id: string) {
    try { await navigator.clipboard.writeText(id); toast("Transaction ID copied"); } catch { toast("Couldn't copy"); }
  }

  const title = mode === "send" ? "Send Money" : "Request Money";

  // ---------- Receipt ----------
  if (step === "receipt" && receipt) {
    return (
      <div className="flow">
        <div className="flow-head"><Link className="back-btn" href="/dashboard" aria-label="Back to home">{ICONS.back}</Link><h1>Receipt</h1><span /></div>
        <section className="receipt">
          <Avatar name={receipt.who.name} />
          <span className="big-amt">{fmt(receipt.amount)}</span>
          <b>{receipt.who.name}</b>
          <span className="muted">{receipt.who.handle}</span>
          {receipt.memo && <span className="note">{ICONS.note}{receipt.memo}</span>}
          <dl className="receipt-list">
            <div><dt>Status</dt><dd className={receipt.mode === "send" ? "ok" : ""}>{receipt.mode === "send" ? "Success" : "Requested"}</dd></div>
            <div><dt>Date</dt><dd>{receipt.at.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}</dd></div>
            <div><dt>Time</dt><dd>{receipt.at.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</dd></div>
            <div className="hl"><dt>Transaction ID</dt><dd>{receipt.id}<button type="button" className="copy-btn" onClick={() => copyId(receipt.id)} aria-label="Copy transaction ID">{ICONS.copy}</button></dd></div>
            <div><dt>Fee</dt><dd>{fmt(0)}</dd></div>
            <div className="total"><dt>Total</dt><dd>{fmt(receipt.amount)}</dd></div>
          </dl>
        </section>
        <button type="button" className="btn ghost wide" onClick={() => share(receipt)}>{ICONS.share}Share Receipt</button>
        <button type="button" className="btn wide" onClick={() => router.push("/dashboard")}>Close</button>
      </div>
    );
  }

  // ---------- Amount + keypad ----------
  if (step === "amount" && who) {
    return (
      <div className="flow">
        <div className="flow-head"><button type="button" className="back-btn" onClick={() => { setStep("pick"); setError(""); }} aria-label="Choose someone else">{ICONS.back}</button><h1>{title}</h1><span /></div>
        <div className="recipient">
          <Avatar name={who.name} />
          <div><b>{who.name}</b><span className="muted">{who.handle}</span></div>
          <select aria-label="Change recipient" value="" onChange={(e) => { const c = state.contacts.find((x) => x.id === e.target.value); if (c) setWho({ name: c.name, handle: c.handle }); }}>
            <option value="" disabled>▾</option>
            {state.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="amount-display">
          <span className="muted">Enter amount</span>
          <output className={cents ? "" : "empty"} aria-live="polite">{fmt(value)}</output>
          {mode === "send"
            ? <span className="hint">Your available balance is <b>{fmt(avail)}</b></span>
            : <span className="hint">They'll get a request to pay you</span>}
        </div>
        <input className="input memo-input" placeholder="Add a note (optional)" maxLength={50} value={memo} onChange={(e) => setMemo(e.target.value)} aria-label="Note" />
        <div className="keypad">
          {KEYS.map((k) => (
            <button key={k} type="button" className={k === "del" ? "del" : undefined} onClick={() => press(k)} aria-label={k === "del" ? "Delete" : k}>
              {k === "del" ? ICONS.del : k}
            </button>
          ))}
        </div>
        {error && <p className="hint bad" role="alert" style={{ textAlign: "center" }}>{error}</p>}
        <button type="button" className="btn wide" disabled={!cents || busy} onClick={submit}>{title}</button>
      </div>
    );
  }

  // ---------- Pick a recipient ----------
  return (
    <div className="flow">
      <div className="flow-head"><Link className="back-btn" href="/dashboard" aria-label="Back to home">{ICONS.back}</Link><h1>{title}</h1><span /></div>
      <Tabs<Mode> label="Send or request" value={mode} onChange={setMode} options={[["send", "Send"], ["request", "Request"]]} />

      {addingNew ? (
        <form className="form" onSubmit={chooseNew} noValidate>
          <div className="field"><label htmlFor="n-name">Name</label><input className="input" id="n-name" value={newWho.name} onChange={(e) => setNewWho({ ...newWho, name: e.target.value })} /></div>
          <div className="field">
            <label htmlFor="n-handle">Email or U.S. mobile number</label>
            <input className="input" id="n-handle" value={newWho.handle} onChange={(e) => setNewWho({ ...newWho, handle: e.target.value })} />
          </div>
          {newError && <p className="hint bad" role="alert">{newError}</p>}
          <button className="btn wide" type="submit">Continue</button>
          <button className="btn ghost wide" type="button" onClick={() => setAddingNew(false)}>Back to contacts</button>
        </form>
      ) : (
        <>
          <div className="pick-list">
            <button type="button" className="pick" onClick={() => setAddingNew(true)}>
              <span className="avatar" style={{ background: "transparent", border: "1.5px dashed var(--accent)" }}>+</span>
              <div><b>New recipient</b><span className="muted">Email or mobile number</span></div>
            </button>
            {state.contacts.map((c) => (
              <button type="button" className="pick" key={c.id} onClick={() => { setWho({ name: c.name, handle: c.handle }); setStep("amount"); }}>
                <Avatar name={c.name} />
                <div><b>{c.name}</b><span className="muted">{c.handle}</span></div>
              </button>
            ))}
          </div>
          <section>
            <div className="sec-head"><h2>Activity</h2></div>
            <div className="tx-cards">
              {state.p2p.slice(0, 8).map((p) => (
                <div className="tx-card" key={p.id}>
                  <Avatar name={p.name} />
                  <div><b>{p.name}</b><span className="muted">{shortDate(p.date)} · {p.memo || "No note"}</span></div>
                  <span className={`amt${p.direction === "received" ? " pos" : ""}`} style={p.direction === "requested" ? { color: "var(--signal)" } : undefined}>
                    {p.direction === "sent" ? "−" : p.direction === "received" ? "+" : ""}{fmt(p.amount)}
                    {p.direction === "requested" && <small>Requested</small>}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
