// Deposits and withdrawals. Both use digital-asset addresses: staff publish the address customers deposit to,
// and customers give the address they want withdrawals sent to. Every request waits for staff approval.
// Shared by the server and the browser.

export const ASSETS = [
  { asset: "BTC", name: "Bitcoin", network: "Bitcoin" },
  { asset: "ETH", name: "Ether", network: "Ethereum" },
  { asset: "USDC", name: "USD Coin", network: "Ethereum (ERC-20)" },
] as const;

export type Asset = (typeof ASSETS)[number]["asset"];
export const isAsset = (v: unknown): v is Asset => ASSETS.some((a) => a.asset === v);
export const assetInfo = (a: Asset) => ASSETS.find((x) => x.asset === a)!;

/** Checks an address has the right shape for its network. Returns a problem, or "" when it looks right. */
export function addressProblem(asset: Asset, address: string): string {
  const a = address.trim();
  if (!a) return "Enter the wallet address.";
  if (asset === "BTC") {
    return /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a) ? "" : "That isn't a Bitcoin address. It should start with bc1, 1 or 3.";
  }
  return /^0x[0-9a-fA-F]{40}$/.test(a) ? "" : "That isn't an Ethereum address. It should start with 0x and have 42 characters.";
}

/** Where customers buy with a card (Ramp Network). They open an account there, verify, and paste the deposit address. */
export const RAMP_URL = "https://rampnetwork.com/buy-crypto";

export const MIN_DEPOSIT = 10;
export const MIN_WITHDRAWAL = 10;

export interface DepositAddress { asset: Asset; network: string; address: string; updatedAt: string }

export type RequestStatus = "pending" | "approved" | "declined";
export interface FundingRequest {
  id: string;
  type: "deposit" | "withdrawal";
  asset: Asset;
  address: string;
  amount: number;
  account: "chk" | "sav";
  reference: string;
  status: RequestStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export const STATUS_LABEL: Record<RequestStatus, string> = { pending: "Pending approval", approved: "Approved", declined: "Declined" };
