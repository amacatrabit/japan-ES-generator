import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ES Writer",
  description: "Local-first ES writing workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
