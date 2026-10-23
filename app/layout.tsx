import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import { AutoTranslate } from "@/components/AutoTranslate";
import { PwaRegister } from "@/components/PwaRegister";
import { themeBootScript } from "@/components/ThemeToggle";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], weight: ["300", "400", "600", "700"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Anchor Bank", template: "%s · Anchor Bank" },
  description: "Anchor Bank: checking, savings, cards and payments in one calm place.",
  applicationName: "Anchor Bank",
  appleWebApp: { capable: true, title: "Anchor", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0E0E19" }, { color: "#FFFFFF" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <div className="bg-glow" aria-hidden="true" />
        {children}
        <PwaRegister />
        <AutoTranslate />
      </body>
    </html>
  );
}
