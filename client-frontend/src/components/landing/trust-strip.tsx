import { CountUp, Etiqueta, Reveal } from "./reveal"

/**
 * The proof, right after the hero: years in business, the Top 5% PME ranking,
 * the CERTIF certification and the size of the catalog. Numbers count up as
 * the band scrolls into view; the badges are the real ones.
 */
export function TrustStrip() {
  return (
    <section className="relative overflow-hidden border-b">
      <div
        aria-hidden
        className="grid-guides pointer-events-none absolute inset-0"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <Reveal className="max-w-2xl">
          <Etiqueta>Confiança comprovada</Etiqueta>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Um parceiro sólido.{" "}
            <span className="text-muted-foreground">
              Reconhecido por entidades independentes.
            </span>
          </h2>
        </Reveal>

        <dl className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <Metrica
            atraso={0}
            valor={<CountUp ate={20} sufixo="+" />}
            rotulo="anos no mercado português de climatização"
          />
          <Metrica
            atraso={80}
            valor="Top 5%"
            rotulo="Melhores PME de Portugal · Scoring 2024"
            selo="/certificacoes/pme2024.png"
            seloAlt="Scoring TOP 5%, Melhores PME Portugal 2024"
          />
          <Metrica
            atraso={160}
            valor="CERTIF"
            rotulo="Assistência certificada SAC-601/2015"
            selo="/certificacoes/certif.png"
            seloAlt="CERTIF, Serviço certificado SAC-601/2015"
          />
          <Metrica
            atraso={240}
            valor={<CountUp ate={1000} sufixo="+" />}
            rotulo="equipamentos em catálogo, de 5 marcas líderes"
          />
        </dl>
      </div>
    </section>
  )
}

function Metrica({
  valor,
  rotulo,
  selo,
  seloAlt,
  atraso,
}: {
  valor: React.ReactNode
  rotulo: string
  /** Optional certification badge shown beside the figure. */
  selo?: string
  seloAlt?: string
  atraso: number
}) {
  return (
    <Reveal
      as="div"
      atraso={atraso}
      className="flex items-start justify-between gap-4 border-l-2 border-primary/40 pl-5"
    >
      <div>
        <dd className="text-4xl font-semibold tracking-tight whitespace-nowrap">
          {valor}
        </dd>
        <dt className="mt-1.5 text-sm text-pretty text-muted-foreground">
          {rotulo}
        </dt>
      </div>
      {selo && (
        <img src={selo} alt={seloAlt ?? ""} className="h-14 w-auto shrink-0" />
      )}
    </Reveal>
  )
}
