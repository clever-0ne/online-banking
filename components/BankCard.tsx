import { cardCvv, cardNumber } from "@/lib/logic";
import type { Card } from "@/lib/types";

/** The card itself: dark face with a mauve (debit) or teal (credit) strip. `revealed` shows the full number and CVV. */
export function BankCard({ card, holder, compact, revealed }: { card: Card; holder: string; compact?: boolean; revealed?: boolean }) {
  return (
    <div
      className={`bankcard ${card.id}${card.locked ? " locked" : ""}${compact ? " compact" : ""}`}
      role="img"
      aria-label={`${card.name} ${revealed ? `number ${cardNumber(card)}, CVV ${cardCvv(card)}` : `ending ${card.last4}`}${card.locked ? ", turned off" : ""}`}
    >
      {card.locked && <span className="lock-tag">Turned off</span>}
      <div className="bc-top">
        <span className="bc-chip" aria-hidden="true" />
        <span className="bc-kind">{card.id === "debit" ? "Anchor debit card" : "Cash Back credit card"}</span>
      </div>
      <div className="bc-pan">{revealed ? cardNumber(card) : `•••• •••• •••• ${card.last4}`}</div>
      <div className="bc-holder">{holder.toUpperCase()}</div>
      <div className="bc-foot">
        <span>Exp {card.exp}</span>
        {revealed && <span>CVV {cardCvv(card)}</span>}
        <span className="bc-net">VISA</span>
      </div>
    </div>
  );
}
