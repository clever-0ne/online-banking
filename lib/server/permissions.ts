// Per-customer page access. A page is on unless staff have switched it off, so pages added later
// are available to everyone until someone restricts them. Server only.
import { isLocked, isPageSlug, PAGES, type PageSlug } from "@/lib/pages";
import { audit, type Actor } from "./admin";
import { all, one, run, tx } from "./db";

export interface PageAccess {
  slug: PageSlug;
  label: string;
  group: string;
  enabled: boolean;
  locked: boolean;
  changedAt: string | null;
  changedBy: string | null;
}

type Row = { page: string; enabled: number; changed_at: string; changed_by: string };

/** Every page and whether this customer can use it, in menu order. */
export async function pageAccess(userId: string): Promise<PageAccess[]> {
  const rows = new Map(
    (await all<Row>("SELECT page, enabled, changed_at, changed_by FROM user_page_access WHERE user_id = ?", userId)).map((r) => [r.page, r]),
  );
  return PAGES.map((p) => {
    const r = rows.get(p.slug);
    const locked = isLocked(p.slug);
    return { slug: p.slug, label: p.label, group: p.group, enabled: locked || !r || r.enabled === 1, locked, changedAt: r?.changed_at ?? null, changedBy: r?.changed_by ?? null };
  });
}

/** The pages switched off for this customer. */
export async function blockedPages(userId: string): Promise<PageSlug[]> {
  return (await all<{ page: string }>("SELECT page FROM user_page_access WHERE user_id = ? AND enabled = 0", userId))
    .map((r) => r.page)
    .filter((p): p is PageSlug => isPageSlug(p) && !isLocked(p));
}

export async function canUse(userId: string, page: PageSlug): Promise<boolean> {
  if (isLocked(page)) return true;
  const r = await one<{ enabled: number }>("SELECT enabled FROM user_page_access WHERE user_id = ? AND page = ?", userId, page);
  return !r || r.enabled === 1;
}

/** Switches pages on or off for one customer. Takes effect on their next request. */
export async function setPageAccess(actor: Actor, target: Actor, changes: Record<string, unknown>): Promise<PageAccess[]> {
  const entries = Object.entries(changes);
  if (!entries.length) throw new Error("Choose at least one page.");
  for (const [page, on] of entries) {
    if (!isPageSlug(page)) throw new Error(`There's no page called "${page}".`);
    if (typeof on !== "boolean") throw new Error("Set each page to true (on) or false (off).");
    if (isLocked(page) && !on) throw new Error("The dashboard is always on.");
  }
  const label = (s: string) => PAGES.find((p) => p.slug === s)!.label;
  await tx(async () => {
    const before = new Map((await pageAccess(target.id)).map((p) => [p.slug, p.enabled]));
    const now = new Date().toISOString();
    for (const [page, on] of entries as [PageSlug, boolean][]) {
      if (before.get(page) === on) continue;
      await run(
        `INSERT INTO user_page_access (user_id, page, enabled, changed_at, changed_by) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, page) DO UPDATE SET enabled = excluded.enabled, changed_at = excluded.changed_at, changed_by = excluded.changed_by`,
        target.id, page, on ? 1 : 0, now, actor.email,
      );
      await audit(actor, on ? "page_enabled" : "page_disabled", target, label(page));
    }
  }, target.id);
  return pageAccess(target.id);
}
