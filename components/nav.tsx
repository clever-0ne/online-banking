// Site map and the few icons the header uses.

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Accounts",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: icon(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>) },
      { href: "/activity", label: "Activity", icon: icon(<path d="M4 6h16M4 12h16M4 18h10" />) },
      { href: "/statements", label: "Statements", icon: icon(<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>) },
    ],
  },
  {
    title: "Pay & transfer",
    items: [
      { href: "/transfer", label: "Transfer", icon: icon(<path d="M4 8h14l-4-4M20 16H6l4 4" />) },
      { href: "/send", label: "Send money", icon: icon(<><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>) },
      { href: "/bills", label: "Bill pay", icon: icon(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>) },
      { href: "/deposit", label: "Deposit", icon: icon(<><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></>) },
      { href: "/withdraw", label: "Withdraw", icon: icon(<><path d="M12 15V3M7 8l5-5 5 5" /><path d="M4 21h16" /></>) },
    ],
  },
  {
    title: "Plan & track",
    items: [
      { href: "/explore", label: "Explore", icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>) },
      { href: "/budget", label: "Budget", icon: icon(<><path d="M12 3v9l7 4" /><circle cx="12" cy="12" r="9" /></>) },
      { href: "/goals", label: "Savings goals", icon: icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>) },
      { href: "/credit", label: "Credit score", icon: icon(<><path d="M4 16a8 8 0 0 1 16 0" /><path d="M12 16l4-5" /></>) },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/cards", label: "Cards", icon: icon(<><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></>) },
      { href: "/alerts", label: "Alerts", icon: icon(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>) },
      { href: "/profile", label: "Profile", icon: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>) },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

/** Anything on the page can open the menu by firing this event (Home's "More" button does). */
export const OPEN_MENU_EVENT = "anchor-open-menu";

export const ICONS = {
  menu: icon(<path d="M4 7h16M4 12h16M4 17h16" />),
  close: icon(<path d="M6 6l12 12M18 6 6 18" />),
  sun: icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  moon: icon(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />),
  bell: icon(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  transfer: icon(<path d="M4 8h14l-4-4M20 16H6l4 4" />),
  send: icon(<><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>),
  bill: icon(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>),
  deposit: icon(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 14h6M16 10h1" /></>),
  arrow: icon(<path d="M9 6l6 6-6 6" />),
  shield: icon(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  users: icon(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>),
  search: icon(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  back: icon(<path d="M15 6l-6 6 6 6" />),
  home: icon(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h5v-6h4v6h5V10" /></>),
  compass: icon(<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>),
  payments: icon(<><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v11" /></>),
  plusCircle: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  history: icon(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>),
  card: icon(<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></>),
  user: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  topup: icon(<><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 15h2" /><path d="M12 2v3" /></>),
  request: icon(<><path d="M12 4v12M6 10l6 6 6-6" /><path d="M4 20h16" /></>),
  more: icon(<><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>),
  del: icon(<><path d="M9 6h11v12H9l-6-6z" /><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" /></>),
  copy: icon(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>),
  share: icon(<><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>),
  note: icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  eye: icon(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  eyeOff: icon(<><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
};
