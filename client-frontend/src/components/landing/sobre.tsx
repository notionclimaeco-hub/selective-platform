import { CountUp, Etiqueta, Reveal } from "./reveal"

/**
 * About teaser: one headline, one paragraph, four figures. The full story
 * lives on /sobre; the landing only needs to say who is behind the prices.
 */
export function Sobre() {
  return (
    <section id="sobre" className="scroll-mt-20 border-t py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Etiqueta>Sobre nós</Etiqueta>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Um parceiro de distribuição,{" "}
            <span className="text-muted-foreground">há mais de 20 anos.</span>
          </h2>
          <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
            A Clima Eco Selective fornece equipamento das marcas líderes a
            empresas instaladoras e gabinetes de projeto em todo o país. Stock
            confirmado junto dos fornecedores, documentação técnica em cada
            modelo e levantamento no nosso armazém.
          </p>
        </Reveal>

        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:mt-12 lg:grid-cols-4">
          <Figura
            atraso={0}
            valor={<CountUp ate={20} sufixo="+" />}
            rotulo="Anos de atividade"
          />
          <Figura
            atraso={80}
            valor={<CountUp ate={5} />}
            rotulo="Marcas em distribuição oficial"
          />
          <Figura
            atraso={160}
            valor={<CountUp ate={1000} sufixo="+" />}
            rotulo="Equipamentos em catálogo"
          />
          <Figura
            atraso={240}
            valor={
              <img
                src="/certificacoes/pme2024.png"
                alt="Scoring TOP 5%, Melhores PME Portugal 2024"
                className="h-12 w-auto sm:h-14"
              />
            }
            rotulo="Top 5% PME Portugal 2024"
          />
        </dl>
      </div>
    </section>
  )
}

function Figura({
  valor,
  rotulo,
  atraso,
}: {
  valor: React.ReactNode
  rotulo: string
  atraso: number
}) {
  return (
    <Reveal
      as="div"
      atraso={atraso}
      className="flex flex-col justify-end bg-background p-5 sm:p-7"
    >
      <dd className="flex h-14 items-center text-4xl font-semibold tracking-tight sm:text-5xl">
        {valor}
      </dd>
      <dt className="mt-3 text-xs font-medium text-muted-foreground sm:text-sm">
        {rotulo}
      </dt>
    </Reveal>
  )
}
