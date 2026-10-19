import Link from "next/link";

// Shown (with status 403) when a customer opens a page staff have switched off for them.
export default function AccessDenied() {
  return (
    <section className="panel denied">
      <span className="score">403</span>
      <span className="label">Access denied</span>
      <p className="hint">This page isn&apos;t available on your account. Contact us if you think that&apos;s a mistake.</p>
      <Link className="btn" href="/dashboard">Back to dashboard</Link>
    </section>
  );
}
