import type { NextRequest } from "next/server";
import { bankAction } from "@/lib/server/bankRoute";
import { requestWithdrawal } from "@/lib/server/funding";

/** Asks for a withdrawal. Body: asset, address, amount (USD), from. The amount is held until staff approve or decline. */
export const POST = (req: NextRequest) => bankAction(req, "withdraw", requestWithdrawal);
