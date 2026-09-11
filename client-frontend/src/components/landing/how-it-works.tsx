import { Link } from "@tanstack/react-router"
import { ArrowRight, FileText, PackageCheck, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Etiqueta, Reveal } from "./reveal"

const PASSOS = [
  {
    icon: Search,
    titulo: "Explore o catálogo",
    texto:
      "Filtre por marca, família, potência e classe energética. Cada modelo traz a ficha técnica e a página de catálogo do fabricante.",
  },
  {
    icon: FileText,
    titulo: "Peça um orçamento",
    texto:
      "Junte os equipamentos ao pedido de orçamento e receba a proposta da nossa equipa comercial, sem compromisso.",
  },
  {
    icon: PackageCheck,
    titulo: "Encomende online",
    texto:
      "Empresas registadas encomendam com preços de revenda, pagam em segurança e acompanham cada encomenda na área de cliente.",
  },
]

/** Three-step walkthrough of the platform, revealed in a stagger on scroll. */
export function HowItWorks() {
  return (
    <section className="border-b py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Etiqueta>Como funciona</Etiqueta>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Do catálogo à encomenda.{" "}
            <span className="text-muted-foreground">
              Tudo no mesmo sítio, em três passos.
            </span>
          </h2>
        </Reveal>

        <ol className="mt-12 grid overflow-hidden rounded-xl border sm:grid-cols-3">
          {PASSOS.map((passo, i) => (
            <Reveal
              key={passo.titulo}
              as="li"
              atraso={i * 100}
              className="relative flex flex-col gap-4 border-b p-6 last:border-b-0 sm:border-r sm:border-b-0 sm:p-8 sm:last:border-r-0"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg border bg-background text-primary">
                  <passo.icon className="size-5" />
                </span>
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  {`0${i + 1}`}
                </span>
              </div>
              <h3 className="text-lg leading-snug font-semibold">
                {passo.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {passo.texto}
              </p>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-8 flex flex-wrap gap-3">
          <Button render={<Link to="/registo" />} nativeButton={false}>
            Registar empresa
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button
            render={<Link to="/produtos" />}
            nativeButton={false}
            variant="outline"
          >
            Explorar o catálogo
          </Button>
        </Reveal>
      </div>
    </section>
  )
}
