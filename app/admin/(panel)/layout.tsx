import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminBar } from "@/components/admin/AdminBar";
import { adminName, adminPath, isAdmin } from "@/lib/server/adminAuth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Reached only through the hidden ADMIN_PATH (proxy.ts rewrites it here); needs an admin session.
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const base = adminPath();
  if (!base) notFound();
  if (!(await isAdmin())) redirect(`${base}/login`);
  return (
    <div className="adm">
      <AdminBar name={adminName()} base={base} />
      <main className="adm-main">{children}</main>
    </div>
  );
}
