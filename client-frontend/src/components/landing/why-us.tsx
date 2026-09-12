import { BadgeCheck, FileText, Wrench } from "lucide-react"

import { CountUp, Etiqueta, Reveal } from "./reveal"

const PONTOS = [
  {
    icon: BadgeCheck,
    titulo: "Distribuidor oficial",
    texto:
      "Mitsubishi Electric, Daikin, Nipon, Hisense e Midea, com garantia de fabricante e acesso às gamas profissionais completas.",
  },
  {
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

/**
 * About block: the story and three proof points on the left, a 2×2 grid of
 * credentials on the right (years, Top 5% PME badge, CERTIF badge, catalog
 * size). Plain white, hairline borders — no backdrop, no card soup.
 */
export function WhyUs() {
  return (
    <section id="sobre" className="scroll-mt-20 border-t py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <Reveal>
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

          <ul className="mt-8 divide-y border-y">
            {PONTOS.map((p) => (
              <li key={p.titulo} className="flex gap-4 py-4">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-primary">
                  <p.icon className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{p.titulo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {p.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border">
          <Credencial
            atraso={0}
            figura={
              <span className="text-4xl font-semibold tracking-tight sm:text-5xl">
                <CountUp ate={20} sufixo="+" />
              </span>
            }
            titulo="Anos de atividade"
            texto="No mercado português de climatização, ao lado de instaladores e projetistas."
          />
          <Credencial
            atraso={80}
            figura={
              <img
                src="/certificacoes/pme2024.png"
                alt="Scoring TOP 5%, Melhores PME Portugal 2024"
                className="h-16 w-auto"
              />
            }
            titulo="Top 5% PME Portugal"
            texto="Distinguidos entre as melhores PME do país no ranking Scoring 2024."
          />
          <Credencial
            atraso={160}
            figura={
              <img
                src="/certificacoes/certif.png"
                alt="CERTIF, Serviço certificado SAC-601/2015"
                className="h-14 w-auto"
              />
            }
            titulo="Certificação CERTIF"
            texto="Serviço de assistência certificado, SAC-601/2015."
          />
          <Credencial
            atraso={240}
            figura={
              <span className="text-4xl font-semibold tracking-tight sm:text-5xl">
                <CountUp ate={1000} sufixo="+" />
              </span>
            }
            titulo="Equipamentos em catálogo"
            texto="De cinco marcas líderes, com fichas técnicas e preços atualizados."
          />
        </dl>
      </div>
    </section>
  )
}

function Credencial({
  figura,
  titulo,
  texto,
  atraso,
}: {
  figura: React.ReactNode
  titulo: string
  texto: string
  atraso: number
}) {
  return (
    <Reveal
      as="div"
      atraso={atraso}
      className="flex flex-col bg-background p-5 sm:p-7"
    >
      <dd className="flex h-16 items-center">{figura}</dd>
      <dt className="mt-4 text-sm font-semibold">{titulo}</dt>
      <dd className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {texto}
      </dd>
    </Reveal>
  )
}
