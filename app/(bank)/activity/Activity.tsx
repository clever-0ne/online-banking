"use client";

import { useMemo, useState } from "react";
import { useBank } from "@/components/BankProvider";
import { TxList } from "@/components/TxList";
import { PageHead } from "@/components/ui";
import { fmt, mask, signed } from "@/lib/format";
import { available, sortedTx } from "@/lib/logic";
import type { AccountId } from "@/lib/types";

export function Activity({ initialAccount }: { initialAccount?: string }) {
  const { state } = useBank();
  const [q, setQ] = useState("");
  const [acct, setAcct] = useState(state.accounts.some((a) => a.id === initialAccount) ? initialAccount! : "all");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");

  const cats = useMemo(() => [...new Set(state.tx.map((t) => t.cat))].sort(), [state.tx]);
  const needle = q.trim().toLowerCase();
  const list = sortedTx(state.tx).filter(
    (t) =>
      (acct === "all" || t.acct === acct) &&
      (cat === "all" || t.cat === cat) &&
      (status === "all" || t.status === status) &&
      (!needle || `${t.payee} ${t.memo}`.toLowerCase().includes(needle) || Math.abs(t.amount).toFixed(2).includes(needle)),
  );
  const net = list.reduce((s, t) => s + t.amount, 0);
  const selected = acct === "all" ? null : state.accounts.find((a) => a.id === (acct as AccountId))!;

  return (
    <>
      <PageHead title={selected ? selected.name : "Activity"} sub={selected ? `Account ${mask(selected.last4)} · Routing ${state.routing}` : "Every transaction across your accounts. Pending items haven't posted yet."} />
      {selected && (
        <div className="tiles">
          <div className="panel tile"><span className="label">{selected.kind === "credit" ? "Available credit" : "Available balance"}</span><span className="num big">{fmt(available(state, selected.id))}</span></div>
          <div className="panel tile"><span className="label">{selected.kind === "credit" ? "Current balance owed" : "Current posted balance"}</span><span className="num big">{fmt(selected.kind === "credit" ? -selected.balance : selected.balance)}</span></div>
          {selected.kind === "credit" && <div className="panel tile"><span className="label">Statement balance</span><span className="num big">{fmt(selected.statementBalance ?? 0)}</span></div>}
          {selected.apy && <div className="panel tile"><span className="label">Interest rate</span><span className="num big">{selected.apy.toFixed(2)}% APY</span></div>}
        </div>
      )}
      <section className="panel">
        <div className="filters">
          <input className="input" id="f-q" type="search" placeholder="Search payee, memo or amount" aria-label="Search transactions" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" id="f-acct" aria-label="Account" value={acct} onChange={(e) => setAcct(e.target.value)}>
            <option value="all">All accounts</option>
            {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} {mask(a.last4)}</option>)}
          </select>
          <select className="input" id="f-cat" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" id="f-status" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Pending and posted</option>
            <option value="pending">Pending only</option>
            <option value="posted">Posted only</option>
          </select>
        </div>
        <p className="hint" style={{ paddingTop: 6 }}>
          {list.length} transactions · net <span className="num">{signed(net)}</span>
        </p>
        <TxList items={list} accounts={state.accounts} showAccount={acct === "all"} />
      </section>
    </>
  );
}
