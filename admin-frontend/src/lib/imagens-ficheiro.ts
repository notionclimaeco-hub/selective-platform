// Browser-side helpers for image files: resize before upload, hash, measure,
// and POST to a Convex storage upload URL.

const FORMATO_NAO_SUPORTADO =
  "Formato de imagem não suportado (use JPEG, PNG ou WebP)."

async function descodificar(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob)
  } catch {
    throw new Error(FORMATO_NAO_SUPORTADO)
  }
}

// Scales the image down so its longest side is at most maxPx. PNG stays PNG,
// WebP stays WebP (both keep transparency); everything else becomes JPEG 0.85.
// JPEG/PNG/WebP files that are already small enough are returned as-is.
// Undecodable files reject with a Portuguese message.
export async function redimensionar(file: File, maxPx = 1600): Promise<Blob> {
  const bitmap = await descodificar(file)
  const escala = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height))
  const tipo =
    file.type === "image/png" || file.type === "image/webp"
      ? file.type
      : "image/jpeg"
  if (escala === 1 && file.type === tipo) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas vazio"))),
      tipo,
      0.85
    )
  )
}

export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function dimensoes(
  blob: Blob
): Promise<{ largura: number; altura: number }> {
  const bitmap = await descodificar(blob)
  const medidas = { largura: bitmap.width, altura: bitmap.height }
  bitmap.close()
  return medidas
}

// Returns the storage id of the uploaded blob.
export async function enviarParaStorage(
  blob: Blob,
  gerarUploadUrl: () => Promise<string>
): Promise<string> {
  const url = await gerarUploadUrl()
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  })
  if (!res.ok) throw new Error(`Upload falhou (${res.status})`)
  const { storageId } = (await res.json()) as { storageId: string }
  return storageId
}
