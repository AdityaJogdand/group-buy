import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./site.css";

// Inter everywhere so Windows judges see the same type as Mac (SF-like metrics).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Group Buy",
  description: "Pool with strangers for the bulk price. PayPal holds your max; you pay the group price, or nothing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Before first paint: saved theme, else the system's. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme")||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
