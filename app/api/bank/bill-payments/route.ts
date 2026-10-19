import type { NextRequest } from "next/server";
import { payBill } from "@/lib/server/bank";
import { bankAction } from "@/lib/server/bankRoute";

/** Pay a payee from checking. Body: billerId, amount, date, repeat. */
export const POST = (req: NextRequest) => bankAction(req, "bills", payBill);
