import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Minefield — Daily Mini-Games",
  description: "A fast daily feed of satisfying mini-games."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="text-ink antialiased transition-colors dark:text-white">{children}</body>
    </html>
  );
}
