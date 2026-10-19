import type { NextRequest } from "next/server";
import { bankAction } from "@/lib/server/bankRoute";
import { requestDeposit } from "@/lib/server/funding";

/** Reports a deposit the customer has sent. Body: asset, amount (USD), reference (transaction ID, optional), to. Pending until staff approve. */
export const POST = (req: NextRequest) => bankAction(req, "deposit", requestDeposit);
