import type { Metadata } from "next";
import "./admin.css";

// Everything under the hidden staff path. Its styles load only here, so nothing a customer downloads mentions it.
// Staff always see English and US dollars: no translation here.
export const metadata: Metadata = { robots: { index: false, follow: false }, other: { google: "notranslate" } };

export default function StaffRoot({ children }: { children: React.ReactNode }) {
  return children;
}
