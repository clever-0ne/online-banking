"use client";

// Small pieces shared by the admin screens.
import type { AuditEntry } from "@/lib/server/admin";

export const ACTION_LABELS: Record<string, string> = {
  sign_in: "Signed in",
  sign_up: "Opened an account",
  suspend: "Suspended",
  activate: "Reactivated",
  make_admin: "Made admin",
  remove_admin: "Removed admin role",
  admin_sign_in: "Staff signed in",
  admin_sign_in_failed: "Failed staff sign-in",
  sign_out_everywhere: "Signed out everywhere",
  reset_password: "Reset password",
  update_profile: "Edited details",
  reset_bank_data: "Reset banking data",
  delete_user: "Deleted user",
  password_changed: "Changed password",
  password_reset_requested: "Asked for a password reset email",
  password_reset: "Reset password by email",
  deposit_requested: "Reported a deposit",
  deposit_approved: "Approved a deposit",
  deposit_declined: "Declined a deposit",
  withdrawal_requested: "Asked to withdraw",
  withdrawal_approved: "Approved a withdrawal",
  withdrawal_declined: "Declined a withdrawal",
  deposit_address_set: "Set a deposit address",
  deposit_address_removed: "Removed a deposit address",
  page_enabled: "Turned a page on",
  page_disabled: "Turned a page off",
  passkey_added: "Added a passkey",
  passkey_removed: "Removed a passkey",
  remove_passkeys: "Removed all passkeys",
  scheduled_payment_failed: "Scheduled payment failed",
};

export const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

export const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status === "active" ? "good" : "bad"}`}>{status === "active" ? "Active" : "Suspended"}</span>;
}

export function AuditList({ items, showTarget = true }: { items: AuditEntry[]; showTarget?: boolean }) {
  if (!items.length) return <p className="empty">Nothing recorded yet.</p>;
  return (
    <ul className="audit-list">
      {items.map((a) => {
        const selfAct = a.actorEmail && a.actorEmail === a.targetEmail;
        return (
          <li key={a.id}>
            <span className={`audit-dot ${a.action}`} aria-hidden="true" />
            <div>
              <b>{ACTION_LABELS[a.action] ?? a.action}</b>
              {showTarget && a.targetEmail && <span className="muted"> · {a.targetEmail}</span>}
              <span className="muted small block">
                {selfAct ? "By the customer" : a.actorEmail ? `By ${a.actorEmail}` : "System"} · {when(a.at)}{a.detail ? ` · ${a.detail}` : ""}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Sends one admin action. Returns the JSON body, or throws with the server's message. */
export async function adminRequest(url: string, method: "PATCH" | "DELETE", body?: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
