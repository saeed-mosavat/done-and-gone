import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import logo from "../brand/done-and-gone-logo.png";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://done-and-gone.vercel.app"),
  title: "Done & Gone",
  description: "Your personal task board.",
  icons: { icon: logo.src, apple: logo.src },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Done & Gone",
    title: "Done & Gone",
    description: "Your personal task board.",
    images: [
      {
        url: "/done-and-gone-preview.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "Done & Gone task board with Todo, Doing, and Done columns.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Done & Gone",
    description: "Your personal task board.",
    images: [
      {
        url: "/done-and-gone-preview.jpg",
        alt: "Done & Gone task board with Todo, Doing, and Done columns.",
      },
    ],
  },
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
