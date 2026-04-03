import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { DifferentiatorsSection } from "@/components/landing/differentiators-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { CtaSection } from "@/components/landing/cta-section";

export const metadata: Metadata = {
  title: "AppRanks — App Marketplace Intelligence Platform",
  description:
    "Track rankings, monitor competitors, and optimize your app store presence across multiple marketplaces.",
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DifferentiatorsSection />
      <TestimonialsSection />
      <CtaSection />
    </>
  );
}
