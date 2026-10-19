import { Fragment } from "react";
import { dayLabel, initials, signed } from "@/lib/format";
import type { Account, Tx } from "@/lib/types";

export function TxList({ items, accounts, showAccount = true }: { items: Tx[]; accounts: Account[]; showAccount?: boolean }) {
  if (!items.length) return <p className="empty">No transactions match. Try a different search, account or category.</p>;
  return (
    <div className="tx-list">
      {items.map((t, i) => {
        const newDay = i === 0 || items[i - 1].date !== t.date;
        const acct = accounts.find((a) => a.id === t.acct);
        return (
          <Fragment key={t.id}>
            {newDay && <div className="tx-day">{dayLabel(t.date)}</div>}
            <div className="tx">
              <div className="tx-ico">{initials(t.payee)}</div>
              <div className="tx-main">
                <b>{t.payee}</b>
                <span>{t.memo} · {t.cat}{showAccount && acct ? ` · ${acct.name}` : ""}</span>
              </div>
              <div className={`tx-amt${t.amount > 0 ? " pos" : ""}`}>
                {signed(t.amount)}
                {t.status === "pending" && <small><span className="pill pending">Pending</span></small>}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
