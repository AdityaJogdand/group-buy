import { Suspense } from "react";
import { Trail } from "./trail";
import { Nav, Footer } from "../../nav";

export const metadata = { title: "Group Buy · Proof" };

export default function Audit() {
  return (
    <>
      <Nav />
      <main className="container-x max-w-3xl! py-16 sm:py-24">
        <Suspense fallback={<p className="text-xl text-muted">Loading the record…</p>}><Trail /></Suspense>
      </main>
      <Footer />
    </>
  );
}
