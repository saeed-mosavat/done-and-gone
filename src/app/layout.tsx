import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import logo from "../brand/done-and-gone-logo.png";
import "./globals.css";

export const metadata: Metadata = {
  title: "Done & Gone",
  description: "Your personal task board.",
  icons: { icon: logo.src, apple: logo.src },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
