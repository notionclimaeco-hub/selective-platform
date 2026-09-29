import { useEffect, useMemo, useRef } from "react"

// Object URLs for local previews (fresh uploads). `revogar` only touches URLs
// this hook created; every URL still outstanding is revoked on unmount.
export function useObjectUrls(): {
  criar: (blob: Blob) => string
  revogar: (url: string) => void
} {
  const urls = useRef(new Set<string>())

  useEffect(() => {
    const ativos = urls.current
    return () => {
      for (const url of ativos) URL.revokeObjectURL(url)
      ativos.clear()
    }
  }, [])

  return useMemo(
    () => ({
      criar(blob: Blob) {
        const url = URL.createObjectURL(blob)
        urls.current.add(url)
        return url
      },
      revogar(url: string) {
        if (!urls.current.delete(url)) return
        URL.revokeObjectURL(url)
      },
    }),
    []
  )
}
