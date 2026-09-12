import { useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  VinhetaEncomenda,
  VinhetaLevantamento,
  VinhetaPagamento,
  VinhetaPrecos,
  VinhetaRegisto,
  VinhetaStock,
} from "./flow-vignettes"
import { Etiqueta, Reveal } from "./reveal"

const PASSOS = [
  {
    titulo: "Registe a sua empresa",
    texto:
      "Crie a conta da empresa instaladora ou projetista. Validamos os dados e aprovamos o acesso aos preços de distribuidor.",
    Vinheta: VinhetaRegisto,
  },
  {
    titulo: "Escolha os equipamentos ao seu preço",
    texto:
      "Com sessão iniciada, o catálogo mostra os seus preços de distribuidor. Junte os equipamentos à encomenda com um clique.",
    Vinheta: VinhetaPrecos,
  },
  {
    titulo: "Submeta a encomenda",
    texto:
      "Reveja as linhas e submeta. Os preços ficam congelados enquanto tratamos do resto.",
    Vinheta: VinhetaEncomenda,
  },
  {
    titulo: "Confirmamos o stock",
    texto:
      "Verificamos a disponibilidade de cada linha junto dos fornecedores e mantemo-lo informado na área de cliente.",
    Vinheta: VinhetaStock,
  },
  {
    titulo: "Paga em segurança",
    texto:
      "Recebe um link de pagamento por transferência bancária, válido 7 dias. A fatura-recibo é emitida assim que o pagamento entra.",
    Vinheta: VinhetaPagamento,
  },
  {
    titulo: "Levante no nosso armazém",
    texto:
      "Avisamos quando os equipamentos estão disponíveis para levantamento. Acompanha tudo, unidade a unidade, na sua encomenda.",
    Vinheta: VinhetaLevantamento,
  },
]

/**
 * The full journey, told Attio-style: on desktop a sticky step list on the
 * left tracks the panel currently crossing the middle of the viewport, while
 * the panels on the right (one animated vignette per step) scroll past. On
 * phones it collapses to a single column with the step text above each
 * vignette.
 */
export function FlowSteps() {
  const [ativo, setAtivo] = useState(0)
  const paineis = useRef<Array<HTMLLIElement | null>>([])

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const i = paineis.current.indexOf(e.target as HTMLLIElement)
          if (i >= 0) setAtivo(i)
        }
      },
      // A panel becomes active when it crosses the middle band of the viewport.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    )
    paineis.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 border-b py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Etiqueta>Como funciona</Etiqueta>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Do registo ao levantamento.{" "}
            <span className="text-muted-foreground">
              Seis passos, tudo acompanhado na área de cliente.
            </span>
          </h2>
        </Reveal>

        <div className="mt-12 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
          {/* Sticky step index (desktop) */}
          <ol
            className="sticky top-24 hidden self-start lg:block"
            aria-label="Passos"
          >
            {PASSOS.map((p, i) => (
              <li key={p.titulo}>
                <button
                  type="button"
                  onClick={() =>
                    paineis.current[i]?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    })
                  }
                  aria-current={ativo === i ? "step" : undefined}
                  className={cn(
                    "flex w-full items-baseline gap-3 border-l-2 py-2.5 pl-4 text-left text-sm transition-colors duration-300",
                    ativo === i
                      ? "border-primary font-medium text-foreground"
                      : "border-border text-muted-foreground/60 hover:text-muted-foreground"
                  )}
                >
                  <span className="text-xs tabular-nums">{`0${i + 1}`}</span>
                  {p.titulo}
                </button>
              </li>
            ))}
          </ol>

          {/* Panels */}
          <ol className="space-y-14 lg:space-y-0">
            {PASSOS.map((p, i) => (
              <li
                key={p.titulo}
                ref={(el) => {
                  paineis.current[i] = el
                }}
                className="lg:flex lg:min-h-[75vh] lg:flex-col lg:justify-center lg:py-8"
              >
                <Reveal>
                  <p className="text-xs font-medium text-primary tabular-nums lg:hidden">
                    {`Passo 0${i + 1}`}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight lg:mt-0 lg:text-2xl">
                    {p.titulo}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground lg:text-base">
                    {p.texto}
                  </p>
                </Reveal>
                <Reveal atraso={120} className="mt-6">
                  <p.Vinheta />
                </Reveal>
              </li>
            ))}
          </ol>
        </div>

        <Reveal className="mt-14 flex flex-wrap gap-3 lg:mt-4">
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
