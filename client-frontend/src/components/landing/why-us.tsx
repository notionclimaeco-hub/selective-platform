import { Award } from "lucide-react"

type Cartao = {
  titulo: string
  texto: string
  icon?: typeof Award
  logo?: string
  logoAlt?: string
}

const CARTOES: Array<Cartao> = [
  {
    icon: Award,
    titulo: "Mais de 20 anos de atividade",
    texto:
      "Duas décadas no setor da climatização, com relações duradouras com instaladores e projetistas em todo o país.",
  },
  {
    logo: "/certificacoes/pme2024.png",
    logoAlt: "Scoring TOP 5%, Melhores PME Portugal 2024",
    titulo: "Top 5% PME Portugal",
    texto:
      "Distinguidos entre as melhores PME de Portugal, no TOP 5% do ranking Scoring 2024.",
  },
  {
    logo: "/certificacoes/certif.png",
    logoAlt: "CERTIF, Serviço certificado SAC-601/2015",
    titulo: "Certificado CERTIF",
    texto:
      "Serviço de assistência certificado pela CERTIF (SAC-601/2015), ao abrigo do DEC-LEI 145/2017.",
  },
]

export function WhyUs() {
  return (
    <section
      id="sobre"
      className="scroll-mt-20 border-t bg-secondary/40 py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Sobre nós
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Um parceiro de confiança, há mais de 20 anos
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            A Clima Eco Selective é uma empresa estabelecida no mercado
            português de climatização. A nossa longevidade e o reconhecimento
            de entidades independentes são o reflexo da confiança dos nossos
            parceiros e da seriedade com que tratamos cada projeto.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {CARTOES.map((cartao) => (
            <div
              key={cartao.titulo}
              className="flex flex-col gap-5 rounded-2xl border bg-card p-8 shadow-sm"
            >
              <span className="flex size-16 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
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
              <h3 className="text-lg font-semibold leading-snug">
                {cartao.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {cartao.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
