import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileNav from "@/components/promaster/MobileNav";
import CookieConsent from "@/components/CookieConsent";
import OfferPopup from "@/components/promaster/OfferPopup";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <MobileNav />
      {children}
      <Footer />
      <CookieConsent />
      <OfferPopup />
    </>
  );
}
