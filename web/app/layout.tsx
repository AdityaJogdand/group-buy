import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// One variable font, width axis included: wide for the wordmark, condensed for headlines.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "Group Buy",
  description: "Pool with strangers for the bulk price. PayPal holds your max; you pay the group price, or nothing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
