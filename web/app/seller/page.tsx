import { Nav, Footer, Head } from "../nav";
import { Dashboard } from "./dashboard";

export const metadata = { title: "Group Buy · Seller dashboard" };

export default function Seller() {
  return (
    <>
      <Nav />
      <main className="container-x py-16 sm:py-20">
        <Head tag="Seller" title="Your store" sub="List products, set group prices, and watch holds turn into sales." />
        <div className="mt-10"><Dashboard /></div>
      </main>
      <Footer />
    </>
  );
}
