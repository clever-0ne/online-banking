import type { NextRequest } from "next/server";
import { contributeToGoal } from "@/lib/server/bank";
import { bankAction } from "@/lib/server/bankRoute";

/** Move money from checking to savings toward a goal. Body: goalId, amount. */
export const POST = (req: NextRequest) => bankAction(req, "goals", contributeToGoal);
