import { redirect } from "next/navigation";
import { BankProvider } from "@/components/BankProvider";
import { Shell } from "@/components/Shell";
import { currentUser } from "@/lib/server/current";
import { blockedPages } from "@/lib/server/permissions";

// Every banking page needs a valid session, checked here on the server (proxy.ts checks first).
export const dynamic = "force-dynamic";

export default async function BankLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <BankProvider user={{ id: user.id, name: user.name, email: user.email, phone: user.phone, createdAt: user.createdAt }} blocked={await blockedPages(user.id)}>
      <Shell>{children}</Shell>
    </BankProvider>
  );
}
