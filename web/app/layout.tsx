import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Group Buy",
  description: "Pool with strangers for the bulk price. PayPal holds your max; you pay the group price, or nothing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
