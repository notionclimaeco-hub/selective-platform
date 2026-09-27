import { createFileRoute } from "@tanstack/react-router"

import { BrandMarquee } from "@/components/landing/brand-marquee"
import { Hero } from "@/components/landing/hero"
import { FlowSteps } from "@/components/landing/flow-steps"
import { ProductShowcase } from "@/components/landing/product-showcase"
import { ClosingCta } from "@/components/landing/closing-cta"
import { WhyUs } from "@/components/landing/why-us"

export const Route = createFileRoute("/_shell/")({ component: LandingPage })

function LandingPage() {
  return (
    <>
      <Hero />
      <FlowSteps />
      <BrandMarquee />
      <ProductShowcase />
      <WhyUs />
      <ClosingCta />
    </>
  )
}
