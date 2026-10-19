import type { Metadata } from "next";
import { Activity } from "./Activity";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  return <Activity initialAccount={account} />;
}
