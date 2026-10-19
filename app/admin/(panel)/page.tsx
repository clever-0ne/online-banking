import { AdminHome } from "@/components/admin/AdminHome";
import { listUsers, recentAudit, stats } from "@/lib/server/admin";
import { SetupCheck } from "@/components/admin/SetupCheck";
import { adminPath } from "@/lib/server/adminAuth";
import { setupCheck } from "@/lib/server/health";

export default async function AdminPage() {
  return <AdminHome base={adminPath()!} initialUsers={await listUsers({})} stats={await stats()} audit={await recentAudit(20)} setup={<SetupCheck items={await setupCheck()} />} />;
}
