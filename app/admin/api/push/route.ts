import { adminGuard, adminPath } from "@/lib/server/adminAuth";
import { pushRoutes } from "@/lib/server/pushRoute";

/** Staff push notifications on this device: new deposits and withdrawals to review. */
export const { GET, POST, DELETE } = pushRoutes(
  async () => (await adminGuard()) ?? { audience: "staff", userId: null },
  { title: "Staff notifications are on", body: "You'll hear about new deposits and withdrawals to review.", url: `${adminPath() ?? ""}/funding` },
);
