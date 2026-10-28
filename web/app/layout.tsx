import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./theme.css";

// Inter everywhere so Windows judges see the same type as Mac (SF-like metrics).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Group Buy",
  description: "Pool with strangers for the bulk price. PayPal holds your max; you pay the group price, or nothing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
