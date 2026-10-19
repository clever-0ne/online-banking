import { requireUser } from "@/lib/server/current";
import { pushRoutes } from "@/lib/server/pushRoute";

/** The signed-in customer's push notifications on this device. */
export const { GET, POST, DELETE } = pushRoutes(
  async () => {
    const r = await requireUser();
    return "response" in r ? r.response : { audience: "customer", userId: r.user.id };
  },
  { title: "Notifications are on", body: "We'll let you know about deposits, withdrawals and sign-ins.", url: "/dashboard" },
);
