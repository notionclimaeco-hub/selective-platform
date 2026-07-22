import { Award, Handshake, ShieldCheck, Wrench } from "lucide-react"

const VALORES = [
  {
    icon: Award,
    titulo: "Mais de 20 anos de experiência",
    texto:
      "Duas décadas de atividade no setor da climatização, com relações duradouras com instaladores e projetistas em todo o país.",
  },
  {
    icon: Handshake,
    titulo: "Distribuição seletiva",
    texto:
      "Trabalhamos com uma rede selecionada de parceiros profissionais, garantindo proximidade, disponibilidade e condições justas.",
  },
  {
    icon: ShieldCheck,
    titulo: "Marcas líderes, garantia oficial",
    texto:
      "Equipamentos originais das principais marcas mundiais, com garantia oficial e acesso direto à documentação técnica.",
  },
  {
    icon: Wrench,
    titulo: "Apoio técnico especializado",
    texto:
      "Acompanhamento na seleção de equipamentos, dimensionamento e pós-venda, por uma equipa com formação de fábrica.",
  },
]

export function WhyUs() {
  return (
    <section id="sobre" className="scroll-mt-20 border-t bg-secondary/40 py-16 md:py-24">
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
            português de climatização. A nossa longevidade é o reflexo da
            confiança dos nossos parceiros — e da seriedade com que tratamos
            cada projeto.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALORES.map((valor) => (
            <div
              key={valor.titulo}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <valor.icon className="size-5" />
              </span>
              <h3 className="font-semibold leading-snug">{valor.titulo}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {valor.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
