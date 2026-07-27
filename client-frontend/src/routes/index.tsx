import { createFileRoute } from "@tanstack/react-router"

import { BrandMarquee } from "@/components/landing/brand-marquee"
import { Hero } from "@/components/landing/hero"
import { ProductShowcase } from "@/components/landing/product-showcase"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { WhyUs } from "@/components/landing/why-us"

export const Route = createFileRoute("/")({ component: LandingPage })

function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <BrandMarquee />
        <ProductShowcase />
        <WhyUs />
      </main>
      <SiteFooter />
    </div>
  )
}
