import { createFileRoute } from "@tanstack/react-router"

import { BrandMarquee } from "@/components/landing/brand-marquee"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { ProductShowcase } from "@/components/landing/product-showcase"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { TrustStrip } from "@/components/landing/trust-strip"
import { WhyUs } from "@/components/landing/why-us"

export const Route = createFileRoute("/")({ component: LandingPage })

function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <BrandMarquee />
        <HowItWorks />
        <ProductShowcase />
        <WhyUs />
      </main>
      <SiteFooter />
    </div>
  )
}
