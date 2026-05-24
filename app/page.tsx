import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Gallery } from "@/components/Gallery";
import { FAQ } from "@/components/FAQ";
import { EmailSignup } from "@/components/EmailSignup";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Gallery />
      <FAQ />
      <EmailSignup source="landing-bottom" />
    </>
  );
}
