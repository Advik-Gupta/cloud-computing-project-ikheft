import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cloud Task Scheduling Optimizer - HEFT vs IKHeft",
  description:
    "Interactive demo comparing the HEFT baseline against the IKHeft local search on randomly generated cloud workflows.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
