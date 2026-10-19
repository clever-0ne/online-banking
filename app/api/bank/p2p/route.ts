import type { NextRequest } from "next/server";
import { sendMoney } from "@/lib/server/bank";
import { bankAction } from "@/lib/server/bankRoute";

/** Send money to a person from checking. Body: name, handle (email or U.S. mobile), amount, memo. */
export const POST = (req: NextRequest) => bankAction(req, "send", sendMoney);
