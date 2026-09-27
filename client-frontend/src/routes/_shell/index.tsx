import { createFileRoute } from "@tanstack/react-router"

import { BrandMarquee } from "@/components/landing/brand-marquee"
import { ClosingCta } from "@/components/landing/closing-cta"
import { FlowSteps } from "@/components/landing/flow-steps"
import { Hero } from "@/components/landing/hero"
import { ProductDeck } from "@/components/landing/product-deck"
import { Sobre } from "@/components/landing/sobre"

export const Route = createFileRoute("/_shell/")({ component: LandingPage })

function LandingPage() {
  return (
    <>
      <Hero />
      <BrandMarquee />
      <FlowSteps />
      <ProductDeck />
      <Sobre />
      <ClosingCta />
    </>
  )
}
