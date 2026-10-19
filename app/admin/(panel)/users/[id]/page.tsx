import Link from "next/link";
import { AdminUser } from "@/components/admin/AdminUser";
import { PageAccess } from "@/components/admin/PageAccess";
import { userDetail } from "@/lib/server/admin";
import { adminPath } from "@/lib/server/adminAuth";
import { pageAccess } from "@/lib/server/permissions";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = adminPath()!;
  const user = await userDetail(id);
  if (!user) {
    return (
      <div className="panel glass">
        <h1>Customer not found</h1>
        <p className="muted">They may have been deleted.</p>
        <Link className="btn" href={base}>Back to customers</Link>
      </div>
    );
  }
  return <AdminUser user={user} base={base} pageAccess={<PageAccess userId={user.id} base={base} initial={await pageAccess(user.id)} />} />;
}
