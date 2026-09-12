import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/paginas-catalogo")({
  component: PaginasCatalogo,
})

type Resultado = {
  ficheiro: string
  estado: "ok" | "erro"
  pagina?: number
  mensagem: string
}

// Files are expected to be named like "<anything>-p<N>.pdf" (e.g. "nipon-p54.pdf").
const NOME_PAGINA_REGEX = /-p(\d+)\.pdf$/i

function PaginasCatalogo() {
  const [tabelaOrigem, setTabelaOrigem] = useState("nipon-2025")
  const [ficheiros, setFicheiros] = useState<File[]>([])
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [aEnviar, setAEnviar] = useState(false)

  const gerarUploadUrl = useMutation(api.paginasCatalogo.gerarUploadUrl)
  const upsert = useMutation(api.paginasCatalogo.upsert)
  const existentes = useQuery(api.paginasCatalogo.listarPorTabela, {
    tabelaOrigem,
  })

  async function enviar() {
    if (ficheiros.length === 0) return
    setAEnviar(true)
    const novos: Resultado[] = []

    for (const file of ficheiros) {
      const match = file.name.match(NOME_PAGINA_REGEX)
      if (!match) {
        novos.push({
          ficheiro: file.name,
          estado: "erro",
          mensagem: "Nome não corresponde a <...>-p<N>.pdf",
        })
        continue
      }

      const pagina = Number(match[1])
      try {
        const url = await gerarUploadUrl({})
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        })
        if (!res.ok) {
          throw new Error(`upload falhou (${res.status})`)
        }
        const { storageId } = (await res.json()) as { storageId: string }
        const r = await upsert({
          tabelaOrigem,
          pagina,
          ficheiro: storageId as Id<"_storage">,
        })
        novos.push({
          ficheiro: file.name,
          estado: "ok",
          pagina,
          mensagem: r.substituido ? "substituído" : "carregado",
        })
      } catch (err) {
        novos.push({
          ficheiro: file.name,
          estado: "erro",
          pagina,
          mensagem: err instanceof Error ? err.message : "erro desconhecido",
        })
      }
    }

    setResultados(novos)
    setAEnviar(false)
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 text-sm sm:px-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-foreground">
          Catálogo
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          Páginas do catálogo
        </h1>
        <p className="text-muted-foreground">
          Carregue os PDFs de uma página. Nomeie cada ficheiro como{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            &lt;nome&gt;-p&lt;N&gt;.pdf
          </code>{" "}
          (ex.: <code className="rounded bg-muted px-1 py-0.5 text-xs">nipon-p54.pdf</code>).
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Tabela de origem</span>
          <input
            className="rounded-lg border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={tabelaOrigem}
            onChange={(e) => setTabelaOrigem(e.target.value.trim())}
            placeholder="nipon-2025"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Ficheiros PDF</span>
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="text-muted-foreground file:mr-3 file:rounded-full file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
            onChange={(e) => setFicheiros(Array.from(e.target.files ?? []))}
          />
        </label>

        <Button
          className="self-start"
          disabled={aEnviar || ficheiros.length === 0 || tabelaOrigem === ""}
          onClick={() => void enviar()}
        >
          {aEnviar ? "A enviar…" : "Enviar"}
        </Button>
      </div>

      {resultados.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Resultado</h2>
          <ul className="flex flex-col gap-1">
            {resultados.map((r, i) => (
              <li key={i} className="flex min-w-0 gap-2">
                <span
                  className={cn(
                    "shrink-0",
                    r.estado === "ok" ? "text-green-600" : "text-red-600",
                  )}
                >
                  {r.estado === "ok" ? "OK" : "ERRO"}
                </span>
                <span className="min-w-0 break-words text-muted-foreground">
                  <span className="break-all">{r.ficheiro}</span>
                  {r.pagina !== undefined ? ` · página ${r.pagina}` : ""} —{" "}
                  {r.mensagem}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Páginas carregadas ({tabelaOrigem})</h2>
        {existentes === undefined ? (
          <p className="text-muted-foreground">A carregar…</p>
        ) : existentes.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma página carregada.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-4 font-medium">Página</th>
                <th className="py-1 font-medium">Ficheiro</th>
              </tr>
            </thead>
            <tbody>
              {existentes.map((linha) => (
                <tr key={linha._id} className="border-b">
                  <td className="py-1 pr-4">{linha.pagina}</td>
                  <td className="py-1">
                    {linha.url ? (
                      <a
                        className="text-blue-600 underline"
                        href={linha.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        abrir PDF
                      </a>
                    ) : (
                      <span className="text-muted-foreground">sem ficheiro</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
