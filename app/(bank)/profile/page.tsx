"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { InstallApp } from "@/components/InstallApp";
import { Passkeys } from "@/components/Passkeys";
import { currencyChoice, languageChoice, setCurrencyChoice, setLanguageChoice } from "@/components/visitorLocale";
import { LANGUAGES } from "@/lib/locale";
import { PushToggle } from "@/components/PushToggle";
import { useBank } from "@/components/BankProvider";
import { setThemeChoice, useTheme, type ThemeChoice } from "@/components/ThemeToggle";
import { Switch, Tabs } from "@/components/ui";
import { passwordProblem } from "@/lib/validate";
import { fromISO, longDate, mask, todayISO } from "@/lib/format";
import { formatPhone, handleKind } from "@/lib/logic";
import type { BankState, Profile } from "@/lib/types";

const US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

const RowIcon = ({ d }: { d: React.ReactNode }) => (
  <span className="row-ico" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  </span>
);
const I = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>,
  cake: <><path d="M4 21h16v-8H4z" /><path d="M4 16c2 1 4-1 6 0s4 1 6 0 4-1 4 0" /><path d="M12 13V9M12 6v.01" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  laptop: <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></>,
  mobile: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  leaf: <path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7" />,
  megaphone: <><path d="M3 10v4h4l6 4V6L7 10z" /><path d="M17 9a4 4 0 0 1 0 6" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 20h16" /></>,
};

/** Shrinks a chosen photo to a 192px square so it fits in browser storage. */
function toAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 192, s = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

function passwordStrength(p: string): { score: number; label: string } {
  let score = 0;
  if (p.length >= 12) score++;
  if (p.length >= 16) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  return { score, label: ["Too weak", "Weak", "Fair", "Good", "Strong", "Very strong"][score] };
}

export default function ProfilePage() {
  const { state, update, toast } = useBank();
  const p = state.profile;
  const c = state.customer;
  const setProfile = (fn: (x: Profile) => Profile, msg?: string) => {
    update((s) => ({ ...s, profile: fn(s.profile) }));
    if (msg) toast(msg);
  };
  const years = new Date().getFullYear() - c.since;

  // ----- Photo -----
  const fileRef = useRef<HTMLInputElement>(null);
  async function onPhoto(f: File | undefined) {
    if (!f) return;
    try {
      const photo = await toAvatar(f);
      setProfile((x) => ({ ...x, photo }), "Profile photo updated");
    } catch {
      toast("That file isn't an image we can use. Try a JPG or PNG");
    }
  }

  // ----- Personal info -----
  const [editing, setEditing] = useState(false);
  const blankForm = () => ({ name: c.name, preferredName: p.preferredName, email: c.email, phone: c.phone, ...p.address, dob: p.dob });
  const [form, setForm] = useState(blankForm);
  const [formError, setFormError] = useState("");
  function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    const st = form.state.trim().toUpperCase();
    const err =
      !form.name.trim() ? "Enter your full legal name." :
      handleKind(form.email) !== "email" ? "Enter a valid email address." :
      handleKind(form.phone) !== "phone" ? "Enter a 10-digit U.S. phone number." :
      !form.line1.trim() || !form.city.trim() ? "Enter your street address and city." :
      !US_STATES.includes(st) ? "Use the two-letter state code, like CA or NY." :
      !/^\d{5}(-\d{4})?$/.test(form.zip.trim()) ? "ZIP codes are 5 digits, or 5+4 like 94109-1234." : "";
    setFormError(err);
    if (err) return;
    update((s: BankState) => ({
      ...s,
      customer: { ...s.customer, name: form.name.trim(), email: form.email.trim(), phone: formatPhone(form.phone) },
      profile: { ...s.profile, preferredName: form.preferredName.trim(), dob: form.dob, address: { line1: form.line1.trim(), line2: form.line2.trim(), city: form.city.trim(), state: st, zip: form.zip.trim() } },
    }));
    setEditing(false);
    toast("Personal information saved");
  }

  // ----- Password -----
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwOpen, setPwOpen] = useState(false);
  const [pwError, setPwError] = useState("");
  const strength = passwordStrength(pw.next);
  const [pwBusy, setPwBusy] = useState(false);
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    const err =
      !pw.current ? "Enter your current password." :
      passwordProblem(pw.next, c.email) ||
      (pw.next !== pw.confirm ? "The new passwords don't match." :
      pw.next === pw.current ? "Choose a password you haven't used here before." : "");
    setPwError(err);
    if (err) return;
    setPwBusy(true);
    try {
      const res = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: pw.current, next: pw.next }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPwError(data.error || "Your password wasn't changed. Try again."); return; }
      setProfile((x) => ({ ...x, security: { ...x.security, passwordChanged: todayISO() } }), "Password changed. Other devices were signed out");
      setPw({ current: "", next: "", confirm: "" });
      setPwOpen(false);
    } catch {
      setPwError("Couldn't reach Anchor Bank. Check your connection and try again.");
    } finally { setPwBusy(false); }
  }

  const { choice } = useTheme();

  function downloadData() {
    const blob = new Blob([JSON.stringify({ customer: c, profile: { ...p, photo: p.photo ? "(image)" : undefined }, accounts: state.accounts, transactions: state.tx }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anchor-my-data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const daysSincePw = Math.round((fromISO(todayISO()).getTime() - fromISO(p.security.passwordChanged).getTime()) / 864e5);
  const dobLabel = p.dob ? fromISO(p.dob).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "Not added";

  return (
    <div className="tk">
      <div className="dash-title">
        <h1>Profile</h1>
        <span className="muted">Your details, security and preferences</span>
      </div>

      <div className="tk-grid">
        {/* ---------- Left: profile card ---------- */}
        <aside className="tk-col">
          <section className="tk-panel tk-hero">
            <div className="tk-avatar-wrap">
              <Avatar name={c.name} photo={p.photo} size="xl" />
              <button type="button" className="tk-photo-btn" onClick={() => fileRef.current?.click()} aria-label="Change profile photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <span className="tk-welcome">Welcome back</span>
            <h2 className="tk-name">{c.name}</h2>
            <span className="tk-tier">{p.tier} member</span>
            <div className="tk-stats">
              <div><b>{state.accounts.length}</b><span>Accounts</span></div>
              <div><b>{state.cards.length}</b><span>Cards</span></div>
              <div><b>{years}</b><span>Years</span></div>
            </div>
            {p.photo && <button type="button" className="linkbtn" onClick={() => setProfile((x) => ({ ...x, photo: undefined }), "Photo removed")}>Remove photo</button>}
          </section>

          <section className="tk-panel">
            <div className="tk-head"><h2>Linked banks</h2><Link className="tk-link" href="/transfer">Manage</Link></div>
            {state.external.map((e) => (
              <div className="tk-row" key={e.id}>
                <RowIcon d={I.home} />
                <div className="tk-row-main"><b>{e.nickname}</b><span>{e.bank} · {e.type} {mask(e.last4)}</span></div>
              </div>
            ))}
          </section>
        </aside>

        {/* ---------- Right: details ---------- */}
        <div className="tk-col">
          <section className="tk-panel">
            <div className="tk-head">
              <h2>Personal information</h2>
              {!editing && <button type="button" className="tk-btn" onClick={() => { setForm(blankForm()); setFormError(""); setEditing(true); }}>Edit</button>}
            </div>
            {editing ? (
              <form className="form tk-form" onSubmit={saveInfo} noValidate>
                <div className="row-2">
                  <div className="field"><label htmlFor="pf-name">Full legal name</label><input className="input" id="pf-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="field"><label htmlFor="pf-pref">Preferred name</label><input className="input" id="pf-pref" value={form.preferredName} onChange={(e) => setForm({ ...form, preferredName: e.target.value })} /></div>
                </div>
                <div className="row-2">
                  <div className="field"><label htmlFor="pf-email">Email</label><input className="input" id="pf-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="field"><label htmlFor="pf-phone">Mobile phone</label><input className="input" id="pf-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div className="row-2">
                  <div className="field"><label htmlFor="pf-l1">Street address</label><input className="input" id="pf-l1" autoComplete="address-line1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} /></div>
                  <div className="field"><label htmlFor="pf-l2">Apt, suite <span className="muted">(optional)</span></label><input className="input" id="pf-l2" autoComplete="address-line2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} /></div>
                </div>
                <div className="row-3">
                  <div className="field"><label htmlFor="pf-city">City</label><input className="input" id="pf-city" autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  <div className="field"><label htmlFor="pf-state">State</label><input className="input" id="pf-state" maxLength={2} autoComplete="address-level1" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>
                  <div className="field"><label htmlFor="pf-zip">ZIP</label><input className="input" id="pf-zip" inputMode="numeric" autoComplete="postal-code" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
                </div>
                <div className="field"><label htmlFor="pf-dob">Date of birth</label><input className="input" id="pf-dob" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
                {formError && <p className="hint bad" role="alert">{formError}</p>}
                <div className="actions"><button className="btn" type="submit">Save changes</button><button className="btn ghost" type="button" onClick={() => setEditing(false)}>Cancel</button></div>
              </form>
            ) : (
              <div className="tk-info">
                <div className="tk-row"><RowIcon d={I.mail} /><div className="tk-row-main"><span>Email</span><b>{c.email}</b></div></div>
                <div className="tk-row"><RowIcon d={I.phone} /><div className="tk-row-main"><span>Mobile phone</span><b>{c.phone}</b></div></div>
                <div className="tk-row"><RowIcon d={I.home} /><div className="tk-row-main"><span>Home address</span><b>{p.address.line1 ? <>{p.address.line1}{p.address.line2 ? `, ${p.address.line2}` : ""}, {p.address.city}, {p.address.state} {p.address.zip}</> : "Not added"}</b></div></div>
                <div className="tk-row"><RowIcon d={I.cake} /><div className="tk-row-main"><span>Birthday</span><b>{dobLabel}</b></div></div>
              </div>
            )}
          </section>

          <section className="tk-panel">
            <div className="tk-head"><h2>Security</h2></div>
            <div className="tk-row">
              <RowIcon d={I.lock} />
              <div className="tk-row-main"><b>Password</b><span>Last changed {daysSincePw === 0 ? "today" : `${daysSincePw} days ago`}</span></div>
              <button type="button" className="tk-btn" onClick={() => { setPwOpen((o) => !o); setPwError(""); }}>{pwOpen ? "Cancel" : "Change"}</button>
            </div>
            {pwOpen && (
              <form className="form tk-form tk-sub" onSubmit={savePassword} noValidate>
                <div className="field"><label htmlFor="pw-cur">Current password</label><input className="input" id="pw-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
                <div className="row-2">
                  <div className="field">
                    <label htmlFor="pw-new">New password</label>
                    <input className="input" id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                    {pw.next && (
                      <div className="strength" aria-live="polite">
                        <span className="segments">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < strength.score ? `on s${strength.score}` : ""} />)}</span>
                        <span className="hint">{strength.label}</span>
                      </div>
                    )}
                  </div>
                  <div className="field"><label htmlFor="pw-conf">Confirm new password</label><input className="input" id="pw-conf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
                </div>
                <p className="hint">At least 12 characters with a mix of letters, numbers or symbols.</p>
                {pwError && <p className="hint bad" role="alert">{pwError}</p>}
                <div className="actions"><button className="btn" type="submit" disabled={pwBusy}>{pwBusy ? "Updating…" : "Update password"}</button></div>
              </form>
            )}
            <Passkeys />
            <label className="tk-row">
              <RowIcon d={I.bell} />
              <div className="tk-row-main"><b>Sign-in alerts</b><span>Notify me whenever someone signs in to my account</span></div>
              <Switch id="sec-alerts" label="Sign-in alerts" checked={p.security.loginAlerts} onChange={(v) => setProfile((x) => ({ ...x, security: { ...x.security, loginAlerts: v } }), "Security settings saved")} />
            </label>
          </section>

          <section className="tk-panel">
            <div className="tk-head">
              <h2>Where you're signed in</h2>
              {p.devices.length > 1 && <button type="button" className="tk-btn" onClick={() => setProfile((x) => ({ ...x, devices: x.devices.filter((d) => d.current) }), "Signed out of other devices")}>Sign out others</button>}
            </div>
            {p.devices.map((d) => (
              <div className="tk-row" key={d.id}>
                <RowIcon d={d.name.includes("app") ? I.mobile : I.laptop} />
                <div className="tk-row-main"><b>{d.name}{d.current && <span className="tk-pill teal sm">This device</span>}</b><span>{d.where ? `${d.where} · ` : ""}{d.current ? "Active now" : `Last active ${longDate(d.lastActive)}`}</span></div>
                {!d.current && <button type="button" className="tk-btn" onClick={() => setProfile((x) => ({ ...x, devices: x.devices.filter((y) => y.id !== d.id) }), `Signed out of ${d.name}`)}>Sign out</button>}
              </div>
            ))}
          </section>

          <section className="tk-panel">
            <div className="tk-head"><h2>Preferences</h2></div>
            <PushToggle base="/api/push" label="Notifications on this device" on="You'll get alerts for deposits, withdrawals, sign-ins and security changes" off="Get alerts for deposits, withdrawals, sign-ins and security changes" onToast={toast} />
            <InstallApp />
            <div className="tk-row">
              <RowIcon d={I.moon} />
              <div className="tk-row-main"><b>Appearance</b><span>Follow your device or pick a theme</span></div>
              <Tabs<ThemeChoice> label="Theme" value={choice} onChange={setThemeChoice} options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} />
            </div>
            <div className="tk-row">
              <RowIcon d={I.globe} />
              <div className="tk-row-main"><b>Language</b><span>Automatic uses the language where you are</span></div>
              <select className="input tk-select" aria-label="Language" translate="no" defaultValue={languageChoice()} onChange={(e) => { setLanguageChoice(e.target.value); location.reload(); }}>
                {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
            <div className="tk-row">
              <RowIcon d={I.globe} />
              <div className="tk-row-main"><b>Currency</b><span>Your account is held in US dollars; local amounts use today&apos;s exchange rate</span></div>
              <select className="input tk-select" aria-label="Currency" translate="no" defaultValue={currencyChoice()} onChange={(e) => { setCurrencyChoice(e.target.value); location.reload(); }}>
                <option value="auto">Local currency</option>
                <option value="USD">US dollar (USD)</option>
              </select>
            </div>
            <label className="tk-row">
              <RowIcon d={I.leaf} />
              <div className="tk-row-main"><b>Paperless statements</b><span>Get statements online instead of by mail</span></div>
              <Switch id="pref-paper" label="Paperless statements" checked={p.prefs.paperless} onChange={(v) => setProfile((x) => ({ ...x, prefs: { ...x.prefs, paperless: v } }), v ? "Paperless turned on" : "Paper statements will be mailed")} />
            </label>
            <label className="tk-row">
              <RowIcon d={I.megaphone} />
              <div className="tk-row-main"><b>Offers and news</b><span>Occasional emails about new features and rates</span></div>
              <Switch id="pref-mkt" label="Offers and news" checked={p.prefs.marketing} onChange={(v) => setProfile((x) => ({ ...x, prefs: { ...x.prefs, marketing: v } }), "Email preferences saved")} />
            </label>
            <div className="tk-row">
              <RowIcon d={I.download} />
              <div className="tk-row-main"><b>Your data</b><span>Download your profile, accounts and transactions as a file</span></div>
              <button type="button" className="tk-btn" onClick={downloadData}>Download</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
