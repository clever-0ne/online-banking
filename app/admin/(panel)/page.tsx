import { AdminHome } from "@/components/admin/AdminHome";
import { listUsers, stats } from "@/lib/server/admin";
import { SetupCheck } from "@/components/admin/SetupCheck";
import { adminPath } from "@/lib/server/adminAuth";
import { depositAddresses } from "@/lib/server/funding";
import { setupCheck } from "@/lib/server/health";

export default async function AdminPage() {
  return <AdminHome base={adminPath()!} initialUsers={await listUsers({})} stats={await stats()} addresses={await depositAddresses()} setup={<SetupCheck items={await setupCheck()} />} />;
}
