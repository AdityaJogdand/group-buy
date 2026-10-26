import { Suspense } from "react";
import { Status } from "./status";
import { Nav, Footer } from "../nav";

export const metadata = { title: "Group Buy · You're in" };

// PayPal sends the buyer back here (via the backend's /paypal/return/web) with ?hold, ?cancelled or ?error.
export default function Joined() {
  return (
    <>
      <Nav />
      <main className="container-x flex min-h-[calc(100svh-3.5rem)] flex-col justify-center py-16 sm:py-24">
        <Suspense fallback={<p className="text-xl text-muted">Checking your hold…</p>}>
          <Status />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
