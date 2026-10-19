import type { NextRequest } from "next/server";
import { transfer } from "@/lib/server/bank";
import { bankAction } from "@/lib/server/bankRoute";

/** Transfer between accounts, pay the credit card, or send to another bank. Body: type ("transfer" | "ach"), from, to, amount, date, repeat, memo. */
export const POST = (req: NextRequest) => bankAction(req, "transfer", transfer);
