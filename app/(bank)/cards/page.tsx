"use client";

import { useState } from "react";
import { BankCard } from "@/components/BankCard";
import { useBank } from "@/components/BankProvider";
import { ICONS } from "@/components/nav";
import { PageHead, Switch, Tabs } from "@/components/ui";
import { useReveal } from "@/components/useReveal";
import { addBusinessDays, fmt, longDate, shortDate, todayISO } from "@/lib/format";
import { addTravel, cardNumber, removeTravel, replaceCard, sortedTx, updateCard } from "@/lib/logic";
import type { Card } from "@/lib/types";

const TOGGLES: [keyof Pick<Card, "online" | "abroad" | "contactless">, string, string][] = [
  ["online", "Online and phone purchases", "Shops, apps and subscriptions that don't need the physical card."],
  ["abroad", "International purchases", "Card payments and ATM use outside the U.S."],
  ["contactless", "Tap to pay", "Contactless payments at the register."],
];

export default function CardsPage() {
  const { state, update, toast } = useBank();
  const [cardId, setCardId] = useState<Card["id"]>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("card") === "credit" ? "credit" : "debit",
  );
  const [confirmLost, setConfirmLost] = useState(false);
  const [trip, setTrip] = useState({ destination: "", from: "", to: "" });
  const [tripError, setTripError] = useState("");
  const c = state.cards.find((x) => x.id === cardId)!;
  const set = (patch: Partial<Card>, msg: string) => { update((s) => updateCard(s, c.id, patch)); toast(msg); };
  const reveal = useReveal(30);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(cardNumber(c).replace(/\s/g, ""));
      toast("Card number copied");
    } catch {
      toast("Couldn't copy. Select the number on the card instead");
    }
  }

  // Merchants that charge this card every month, so the customer knows what to update after a replacement.
  const recurring = [...new Map(sortedTx(state.tx).filter((t) => t.acct === c.linked && t.cat === "Subscriptions").map((t) => [t.payee, t])).values()];

  function saveTrip(e: React.FormEvent) {
    e.preventDefault();
    const err = !trip.destination.trim() ? "Where are you going?" : !trip.from || !trip.to ? "Add the dates you'll be away." : trip.to < trip.from ? "The return date is before the departure date." : trip.to < todayISO() ? "That trip is already over." : "";
    setTripError(err);
    if (err) return;
    update((s) => addTravel(s, trip.destination.trim(), trip.from, trip.to));
    setTrip({ destination: "", from: "", to: "" });
    toast("Travel plan added");
  }

  return (
    <>
      <PageHead title="Card controls" sub="Turn a card off in seconds, choose where it works, and tell us before you travel." />
      <Tabs<Card["id"]> label="Card" value={cardId} onChange={(v) => { setCardId(v); setConfirmLost(false); reveal.hide(); }} options={state.cards.map((x) => [x.id, `${x.id === "debit" ? "Debit" : "Credit"} ••${x.last4}`])} />

      <div className="cards-grid">
        <div className="card-col">
          <BankCard card={c} holder={state.customer.name} revealed={reveal.revealed} />
          <div className="reveal-bar">
            {reveal.revealed ? (
              <>
                <span className="hint">Hiding in {reveal.left}s</span>
                <button className="btn ghost small" type="button" onClick={copyNumber}>Copy number</button>
                <button className="btn small" type="button" onClick={reveal.hide}>{ICONS.eyeOff}Hide</button>
              </>
            ) : (
              <button className="btn ghost small" type="button" onClick={reveal.show}>{ICONS.eye}Show card number</button>
            )}
          </div>
          <label className="setting bare panel">
            <div><b>{c.locked ? "Card is off" : "Card is on"}</b><p>{c.locked ? "New purchases and ATM withdrawals are declined." : "Turn it off if you misplaced it. You can turn it back on any time."}</p></div>
            <Switch id="c-on" label="Card on or off" checked={!c.locked} onChange={(v) => set({ locked: !v }, v ? "Card turned on" : "Card turned off")} />
          </label>
          {c.replacementOrdered && <p className="notice">Replacement card ••{c.last4} ordered {shortDate(c.replacementOrdered)}. It should arrive by {longDate(addBusinessDays(c.replacementOrdered, 7))}.</p>}
          {!confirmLost ? (
            <button className="btn ghost block" type="button" onClick={() => setConfirmLost(true)}>Report lost or stolen</button>
          ) : (
            <div className="panel confirm">
              <b>Replace card ••{c.last4}?</b>
              <p className="hint">We'll cancel this card for good and mail a new one with a new number in 5–7 business days. Recurring payments need the new number.</p>
              <div className="actions">
                <button className="btn danger" type="button" onClick={() => { update((s) => replaceCard(s, c.id)); setConfirmLost(false); toast("Card canceled. Replacement ordered"); }}>Cancel card and send a new one</button>
                <button className="btn ghost" type="button" onClick={() => setConfirmLost(false)}>Keep my card</button>
              </div>
            </div>
          )}
        </div>

        <div className="card-col">
          <section className="panel">
            <h2 style={{ marginBottom: 4 }}>Where this card works</h2>
            {TOGGLES.map(([k, title, desc]) => (
              <label className="setting" key={k}>
                <div><b>{title}</b><p>{desc}</p></div>
                <Switch id={`c-${k}`} label={title} checked={c[k]} disabled={c.locked} onChange={(v) => set({ [k]: v }, "Card settings saved")} />
              </label>
            ))}
            <h2 style={{ margin: "22px 0 4px" }}>Daily limits</h2>
            {c.atm !== undefined && (
              <div className="limit-row">
                <header><label htmlFor="l-atm"><b>ATM withdrawals</b></label><span className="num">{fmt(c.atm)}</span></header>
                <input type="range" id="l-atm" min={100} max={1000} step={50} value={c.atm} onChange={(e) => update((s) => updateCard(s, c.id, { atm: Number(e.target.value) }))} onPointerUp={() => toast("Limit updated")} />
              </div>
            )}
            <div className="limit-row">
              <header><label htmlFor="l-spend"><b>Purchases</b></label><span className="num">{fmt(c.spend)}</span></header>
              <input type="range" id="l-spend" min={500} max={c.id === "credit" ? 8000 : 7500} step={250} value={c.spend} onChange={(e) => update((s) => updateCard(s, c.id, { spend: Number(e.target.value) }))} onPointerUp={() => toast("Limit updated")} />
            </div>
          </section>

          <section className="panel">
            <h2 style={{ marginBottom: 4 }}>Where your card is saved</h2>
            <p className="hint" style={{ marginBottom: 6 }}>Merchants that charged this card recently for a subscription.</p>
            {recurring.length === 0 ? <p className="empty">No recurring charges found on this card.</p> : (
              <ul className="plain-list">
                {recurring.map((t) => <li key={t.payee}><div><b>{t.payee}</b><span className="muted">Last charged {shortDate(t.date)}</span></div><span className="num">{fmt(-t.amount)}/mo</span></li>)}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Travel plans</h2><span className="label">All cards</span></div>
        <p className="hint" style={{ marginBottom: 10 }}>Tell us where you're going so purchases abroad aren't flagged as fraud. Make sure international purchases are turned on.</p>
        {state.travel.length > 0 && (
          <ul className="plain-list" style={{ marginBottom: 14 }}>
            {state.travel.map((t) => (
              <li key={t.id}>
                <div><b>{t.destination}</b><span className="muted">{longDate(t.from)} – {longDate(t.to)}</span></div>
                <button className="linkbtn" type="button" onClick={() => { update((s) => removeTravel(s, t.id)); toast("Travel plan removed"); }}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <form className="trip-form" onSubmit={saveTrip} noValidate>
          <div className="field"><label htmlFor="tr-dest">Destination</label><input className="input" id="tr-dest" value={trip.destination} onChange={(e) => setTrip({ ...trip, destination: e.target.value })} placeholder="City, country" /></div>
          <div className="field"><label htmlFor="tr-from">Leaving</label><input className="input" id="tr-from" type="date" min={todayISO()} value={trip.from} onChange={(e) => setTrip({ ...trip, from: e.target.value })} /></div>
          <div className="field"><label htmlFor="tr-to">Returning</label><input className="input" id="tr-to" type="date" min={trip.from || todayISO()} value={trip.to} onChange={(e) => setTrip({ ...trip, to: e.target.value })} /></div>
          <button className="btn" type="submit">Add trip</button>
        </form>
        {tripError && <p className="hint bad" role="alert" style={{ marginTop: 8 }}>{tripError}</p>}
      </section>
    </>
  );
}
