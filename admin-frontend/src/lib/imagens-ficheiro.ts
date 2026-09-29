// Browser-side helpers for image files: resize before upload, hash, measure,
// and POST to a Convex storage upload URL.

// Scales the image down so its longest side is at most maxPx. PNG stays PNG;
// everything else becomes JPEG 0.85. Small JPEG/PNG files are returned as-is.
export async function redimensionar(file: File, maxPx = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height))
  if (escala === 1 && (file.type === "image/jpeg" || file.type === "image/png"))
    return file
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const png = file.type === "image/png"
  return await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas vazio"))),
      png ? "image/png" : "image/jpeg",
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
  const bitmap = await createImageBitmap(blob)
  return { largura: bitmap.width, altura: bitmap.height }
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
