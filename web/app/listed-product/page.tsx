import { Nav, Footer, Head } from "../nav";
import { Groups } from "../groups";
import { Ask } from "../ask";

export const metadata = { title: "Group Buy · Groups filling now" };

// Every listed product with its live group. The landing page's Browse / Join links come here.
export default function ListedProducts() {
  return (
    <>
      <Nav />
      <main className="py-20 sm:py-24">
        <div className="container-x">
          <Head center tag="Filling now" title="Join a group" sub="Pick a group, or tap Ask AI and say what you want." />
        </div>
        <Groups />
      </main>
      <Footer />
      <Ask />
    </>
  );
}
