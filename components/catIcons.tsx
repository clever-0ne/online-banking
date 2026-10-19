// Small line icons for spending categories.

const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const CAT_ICONS: Record<string, React.ReactNode> = {
  Groceries: svg(<><path d="M3 4h2l2.5 11h11L21 7H6.2" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>),
  Dining: svg(<><path d="M5 3v8a3 3 0 0 0 6 0V3M8 3v18" /><path d="M17 3c-2 2-2 6 0 8v10" /></>),
  Shopping: svg(<><path d="M5 8h14l-1 13H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>),
  "Gas & auto": svg(<><path d="M5 16V9l2-4h10l2 4v7" /><path d="M3 16h18v3H3z" /><circle cx="7.5" cy="12.5" r="1" /><circle cx="16.5" cy="12.5" r="1" /></>),
  Utilities: svg(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />),
  Subscriptions: svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" /></>),
  Entertainment: svg(<><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" /><path d="M14 7v10" /></>),
  Housing: svg(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>),
  "Cash & ATM": svg(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>),
  Travel: svg(<path d="M2 16l20-6-3-3-7 2-5-5-2 1 3 6-4 1-2-2-1 1z" />),
  Insurance: svg(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />),
  Transfers: svg(<path d="M4 8h14l-4-4M20 16H6l4 4" />),
  Income: svg(<><path d="M12 20V6M6 12l6-6 6 6" /><path d="M4 21h16" /></>),
};

export const catIcon = (c: string) => CAT_ICONS[c] ?? svg(<circle cx="12" cy="12" r="4" />);
