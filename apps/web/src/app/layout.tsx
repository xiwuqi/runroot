import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TopNavigation } from "../components/console";

import "./globals.css";

export const metadata: Metadata = {
  title: "Runroot Console",
  description:
    "Operator-facing web console for durable Runroot workflows, approvals, and replay.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TopNavigation />
        {children}
      </body>
    </html>
  );
}
