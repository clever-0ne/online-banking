"use client";

// Deposit addresses and the customer's deposits and withdrawals, kept current: staff can change an address
// or approve a request at any time, so this checks again every few seconds while the page is open.
import { useCallback, useEffect, useRef, useState } from "react";
import { useBank } from "./BankProvider";
import type { DepositAddress, FundingRequest } from "@/lib/funding";

const EVERY_MS = 8000;

export function useFunding() {
  const [addresses, setAddresses] = useState<DepositAddress[] | null>(null);
  const [requests, setRequests] = useState<FundingRequest[]>([]);
  const [error, setError] = useState(false);
  const { reload, toast } = useBank();
  // Status of each request last time we looked, so an approval updates the balance on screen.
  const seen = useRef<Map<string, string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/funding", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error();
      const d = (await res.json()) as { addresses: DepositAddress[]; requests: FundingRequest[] };
      setAddresses(d.addresses);
      setRequests(d.requests);
      const before = seen.current;
      seen.current = new Map(d.requests.map((r) => [r.id, r.status]));
      const decided = before ? d.requests.filter((r) => before.get(r.id) === "pending" && r.status !== "pending") : [];
      if (decided.length) {
        await reload();
        const r = decided[0];
        toast(`Your ${r.asset} ${r.type} was ${r.status === "approved" ? "approved" : "declined"}`);
      }
      setError(false);
    } catch {
      setError(true);
    }
  }, [reload, toast]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, EVERY_MS);
    const onShow = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [refresh]);

  return { addresses, requests, error, refresh };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 1500))]);
    return true;
  } catch {
    // Older browsers and some in-app browsers: fall back to a hidden text field.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
