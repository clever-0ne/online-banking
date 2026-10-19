import { initials } from "@/lib/format";

export function Avatar({ name, photo, size = "md" }: { name: string; photo?: string; size?: "md" | "lg" | "xl" }) {
  const cls = `avatar${size === "md" ? "" : " " + size}`;
  return photo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className={`${cls} photo`} src={photo} alt="" />
    : <span className={cls} aria-hidden="true">{initials(name)}</span>;
}
