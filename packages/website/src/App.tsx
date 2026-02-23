import { Hero } from "./features/landing/Hero.tsx";
import { Features } from "./features/landing/Features.tsx";
import { BentoGrid } from "./features/landing/BentoGrid.tsx";
import { HowItWorks } from "./features/landing/HowItWorks.tsx";
import { FAQ } from "./features/landing/FAQ.tsx";
import { Pricing } from "./features/landing/Pricing.tsx";
import { Footer } from "./features/landing/Footer.tsx";
import { Nav } from "./features/landing/Nav.tsx";
import { Install } from "./features/landing/Install.tsx";
import { PrivacyAndTermsPage } from "./features/landing/PrivacyAndTerms.tsx";

function App() {
  if (window.location.pathname.startsWith("/privacy")) {
    return <PrivacyAndTermsPage />;
  }

  if (window.location.pathname === "/install") {
    return <Install />;
  }

  return (
    <>
      <Nav />
      <Hero />
      <Features />
      <BentoGrid />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </>
  );
}

export default App;
