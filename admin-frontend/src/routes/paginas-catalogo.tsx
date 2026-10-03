import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { ExternalLink } from "lucide-react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LinhasEsqueleto } from "@/components/ui/skeleton"
import {
  Cabecalho,
  Marcador,
  Seccao,
  Tabela,
  Td,
  Th,
  Vazio,
  linhaCls,
} from "@/components/ui/tabela"
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

  const okCount = resultados.filter((r) => r.estado === "ok").length

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <Cabecalho titulo="Páginas do catálogo" />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Seccao titulo="Carregar">
            <div className="flex flex-col gap-4 px-5 py-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Tabela de origem</span>
                <Input
                  value={tabelaOrigem}
                  onChange={(e) => setTabelaOrigem(e.target.value.trim())}
                  placeholder="nipon-2025"
                />
              </label>
              {/* pt-PT file control: the native input is visually hidden and
                  keyboard-reachable; the row shows what was picked. */}
              <label className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">Ficheiros PDF</span>
                  <span className="text-xs text-muted-foreground">
                    &lt;nome&gt;-p&lt;N&gt;.pdf
                  </span>
                </span>
                <span className="flex h-10 min-w-0 items-center justify-between gap-3 rounded-lg border border-input bg-background pr-1 pl-3 transition-[color,box-shadow,border-color] has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/25">
                  <span
                    className={cn(
                      "min-w-0 truncate text-sm",
                      ficheiros.length === 0 && "text-muted-foreground"
                    )}
                  >
                    {ficheiros.length === 0
                      ? "Nenhum ficheiro"
                      : ficheiros.length === 1
                        ? ficheiros[0].name
                        : `${ficheiros.length} ficheiros`}
                  </span>
                  <span
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "cursor-pointer"
                    )}
                  >
                    Escolher PDFs
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      className="sr-only"
                      onChange={(e) =>
                        setFicheiros(Array.from(e.target.files ?? []))
                      }
                    />
                  </span>
                </span>
              </label>
              <div className="flex justify-end">
                <Button
                  disabled={
                    aEnviar || ficheiros.length === 0 || tabelaOrigem === ""
                  }
                  onClick={() => void enviar()}
                >
                  {aEnviar
                    ? "A enviar…"
                    : ficheiros.length > 0
                      ? `Enviar ${ficheiros.length} PDF${ficheiros.length === 1 ? "" : "s"}`
                      : "Enviar"}
                </Button>
              </div>
            </div>
          </Seccao>

          {resultados.length > 0 && (
            <Seccao
              titulo="Resultado"
              contagem={`${okCount}/${resultados.length}`}
            >
              <Tabela>
                <thead>
                  <tr>
                    <Th>Ficheiro</Th>
                    <Th num className="hidden sm:table-cell">
                      Página
                    </Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r, i) => (
                    <tr key={i} className={linhaCls}>
                      <Td className="max-w-0 min-w-40">
                        <span className="block break-all">{r.ficheiro}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.pagina !== undefined && (
                            <span className="sm:hidden">
                              página {r.pagina} ·{" "}
                            </span>
                          )}
                          {r.mensagem}
                        </span>
                      </Td>
                      <Td num className="hidden sm:table-cell">
                        {r.pagina ?? "—"}
                      </Td>
                      <Td>
                        <Marcador tom={r.estado === "ok" ? "feito" : "perigo"}>
                          {r.estado === "ok" ? "OK" : "Erro"}
                        </Marcador>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            </Seccao>
          )}
        </div>

        <Seccao
          titulo="Páginas carregadas"
          contagem={existentes?.length ?? "…"}
          accoes={
            tabelaOrigem !== "" && (
              <span className="truncate">{tabelaOrigem}</span>
            )
          }
        >
          {existentes === undefined ? (
            <LinhasEsqueleto colunas={["w-8", "ml-16 w-24"]} />
          ) : existentes.length === 0 ? (
            <Vazio>Nenhuma página carregada.</Vazio>
          ) : (
            <Tabela>
              <thead>
                <tr>
                  <Th className="w-28">Página</Th>
                  <Th>Ficheiro</Th>
                </tr>
              </thead>
              <tbody>
                {existentes.map((linha) => (
                  <tr key={linha._id} className={linhaCls}>
                    <Td className="font-medium">{linha.pagina}</Td>
                    <Td>
                      {linha.url ? (
                        <a
                          className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                          href={linha.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir PDF
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">
                          sem ficheiro
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Seccao>
      </div>
    </main>
  )
}
