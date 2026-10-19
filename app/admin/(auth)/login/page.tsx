import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { adminPath, isAdmin } from "@/lib/server/adminAuth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const base = adminPath();
  if (!base) notFound();
  if (await isAdmin()) redirect(base);
  return <AdminLoginForm base={base} />;
}
