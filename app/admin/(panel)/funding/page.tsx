import { AdminFunding } from "@/components/admin/AdminFunding";
import { adminPath } from "@/lib/server/adminAuth";
import { depositAddresses, fundingQueue } from "@/lib/server/funding";

export default async function AdminFundingPage() {
  return <AdminFunding base={adminPath()!} initial={{ addresses: await depositAddresses(), ...(await fundingQueue()) }} />;
}
