import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { DifferentiatorsSection } from "@/components/landing/differentiators-section";
import { CtaSection } from "@/components/landing/cta-section";

export const metadata: Metadata = {
  title: "AppRanks — Shopify App Store Intelligence Platform",
  description:
    "Track rankings, monitor competitors, optimize keywords. The all-in-one intelligence platform for Shopify app developers.",
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DifferentiatorsSection />
      <CtaSection />
    </>
  );
}
