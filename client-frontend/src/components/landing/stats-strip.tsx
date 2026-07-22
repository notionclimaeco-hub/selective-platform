const STATS = [
  { valor: "20+", legenda: "Anos de atividade" },
  { valor: "5", legenda: "Marcas oficiais" },
  { valor: "270+", legenda: "Equipamentos em catálogo" },
  { valor: "100%", legenda: "Acompanhamento técnico" },
]

export function StatsStrip() {
  return (
    <section className="border-y bg-secondary/60">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.legenda} className="flex flex-col items-center gap-1 text-center">
            <span className="text-4xl font-semibold tracking-tight text-primary">
              {stat.valor}
            </span>
            <span className="text-sm text-muted-foreground">{stat.legenda}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
