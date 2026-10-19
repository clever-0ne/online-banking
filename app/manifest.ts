import type { MetadataRoute } from "next";

// Lets customers install Anchor Bank to their home screen and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Anchor Bank",
    short_name: "Anchor",
    description: "Checking, savings, cards, deposits and withdrawals in one calm place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#3127B4",
    categories: ["finance"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Deposit", url: "/deposit", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Withdraw", url: "/withdraw", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Activity", url: "/activity", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
