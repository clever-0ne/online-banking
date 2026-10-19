import { AdminHome } from "@/components/admin/AdminHome";
import { listUsers, recentAudit, stats } from "@/lib/server/admin";
import { adminPath } from "@/lib/server/adminAuth";

export default async function AdminPage() {
  return <AdminHome base={adminPath()!} initialUsers={await listUsers({})} stats={await stats()} audit={await recentAudit(20)} />;
}
