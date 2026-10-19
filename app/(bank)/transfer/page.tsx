import { Transfer } from "./Transfer";

export default async function TransferPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  return <Transfer initialTo={to} />;
}
