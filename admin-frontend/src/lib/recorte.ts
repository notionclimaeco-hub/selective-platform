// Background removal in the browser. The library and its model (~80 MB for
// the default isnet_fp16, fetched from IMG.LY's CDN and cached by the browser)
// load on first use only.
export type EtapaRecorte = "modelo" | "recorte"

export async function recortarFundo(
  url: string,
  onProgresso: (etapa: EtapaRecorte, pct: number) => void
): Promise<Blob> {
  const { removeBackground } = await carregarBiblioteca()
  const origem = await lerImagem(url)
  // Downloads report per file (model chunks, wasm); sum them into one figure.
  const ficheiros = new Map<string, { atual: number; total: number }>()
  try {
    return await removeBackground(origem, {
      output: { format: "image/png", quality: 1 },
      progress: (chave, atual, total) => {
        if (!chave.startsWith("fetch:")) {
          onProgresso(
            "recorte",
            total > 0 ? Math.round((atual / total) * 100) : 0
          )
          return
        }
        ficheiros.set(chave, { atual, total })
        let soma = 0
        let totalGeral = 0
        for (const f of ficheiros.values()) {
          soma += f.atual
          totalGeral += f.total
        }
        onProgresso(
          "modelo",
          totalGeral > 0 ? Math.round((soma / totalGeral) * 100) : 0
        )
      },
    })
  } catch (err) {
    console.error(err)
    throw new Error("Não foi possível recortar o fundo desta imagem.")
  }
}

// Failures surface in Portuguese, not as the browser's English TypeError.
async function carregarBiblioteca() {
  try {
    return await import("@imgly/background-removal")
  } catch (err) {
    console.error(err)
    throw new Error("Não foi possível carregar o recorte.")
  }
}

async function lerImagem(url: string): Promise<Blob> {
  try {
    const resposta = await fetch(url)
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
    return await resposta.blob()
  } catch (err) {
    console.error(err)
    throw new Error("Não foi possível ler a imagem.")
  }
}
