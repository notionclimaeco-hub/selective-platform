import { BadgeCheck, FileText, Wrench } from "lucide-react"

import { CountUp, Etiqueta, Reveal } from "./reveal"

type Cartao = {
  titulo: string
  texto: string
  icon?: typeof BadgeCheck
  logo?: string
  logoAlt?: string
}

const CARTOES: Array<Cartao> = [
  {
    icon: BadgeCheck,
    titulo: "Distribuidor oficial",
    texto:
      "Mitsubishi Electric, Daikin, Nipon, Hisense e Midea, com garantia de fabricante e acesso às gamas profissionais completas.",
  },
  {
    logo: "/certificacoes/certif.png",
    logoAlt: "CERTIF, Serviço certificado SAC-601/2015",
    icon: Wrench,
    titulo: "Assistência certificada",
    texto:
      "Serviço de assistência certificado pela CERTIF (SAC-601/2015), ao abrigo do Decreto-Lei 145/2017.",
  },
  {
    icon: FileText,
    titulo: "Documentação técnica",
    texto:
      "Fichas técnicas e páginas de catálogo do fabricante em cada modelo, prontas a anexar às suas propostas.",
  },
]

export function WhyUs() {
  return (
    <section
      id="sobre"
      className="relative scroll-mt-20 overflow-hidden border-t bg-muted/40 py-16 md:py-24"
    >
      <div
        aria-hidden
        className="grid-guides pointer-events-none absolute inset-0"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Etiqueta>Sobre nós</Etiqueta>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Um parceiro de confiança.{" "}
            <span className="text-muted-foreground">Há mais de 20 anos.</span>
          </h2>
          <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
            A Clima Eco Selective é uma empresa estabelecida no mercado
            português de climatização. A nossa longevidade e o reconhecimento de
            entidades independentes são o reflexo da confiança dos nossos
            parceiros e da seriedade com que tratamos cada projeto.
          </p>
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

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {CARTOES.map((cartao, i) => (
            <Reveal
              key={cartao.titulo}
              atraso={i * 100}
              className="flex flex-col gap-5 rounded-xl border bg-card p-6 sm:p-8"
            >
              <span className="flex size-14 items-center justify-center overflow-hidden rounded-lg border bg-background text-primary">
                {cartao.logo ? (
                  <img
                    src={cartao.logo}
                    alt={cartao.logoAlt ?? cartao.titulo}
                    className="size-12 object-contain"
                  />
                ) : cartao.icon ? (
                  <cartao.icon className="size-7" />
                ) : null}
              </span>
              <h3 className="text-lg leading-snug font-semibold">
                {cartao.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {cartao.texto}
              </p>
            </Reveal>
          ))}
        </div>
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
