"use client";

// The customer's deposits or withdrawals with their review status.
import { STATUS_LABEL, type FundingRequest } from "@/lib/funding";
import { fmt } from "@/lib/format";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const short = (a: string) => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

export function FundingList({ items, type }: { items: FundingRequest[]; type: "deposit" | "withdrawal" }) {
  const list = items.filter((r) => r.type === type);
  if (!list.length) return <p className="empty">{type === "deposit" ? "No deposits yet." : "No withdrawals yet."}</p>;
  return (
    <ul className="plain-list">
      {list.map((r) => (
        <li key={r.id}>
          <div>
            <b>{r.asset} {type === "deposit" ? "deposit" : "withdrawal"}</b>
            <span className="muted">{when(r.createdAt)} · {type === "deposit" ? (r.reference ? `Ref ${short(r.reference)}` : "No transaction ID") : `To ${short(r.address)}`}</span>
          </div>
          <div className="row-end">
            <span className={`pill ${r.status === "pending" ? "pending" : r.status === "approved" ? "good" : "bad"}`}>{STATUS_LABEL[r.status]}</span>
            <span className={`num${type === "deposit" && r.status === "approved" ? " pos" : ""}`}>{type === "deposit" ? "+" : "−"}{fmt(r.amount)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
