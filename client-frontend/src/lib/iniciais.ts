/**
 * Up to two capital letters for an avatar without a photo: first letter of
 * the first and last word ("Maria da Silva Costa" → "MC"). An email uses its
 * local part without any `+tag`, split on `.`/`_`/`-` ("ana.costa@x.pt" →
 * "AC"). Accents are stripped so the result is safe inside a CSS `content`
 * string.
 */
export function iniciais(nome: string | null | undefined): string {
  if (!nome) return ""
  const base = nome.includes("@")
    ? nome.split("@")[0].split("+")[0]
    : nome
  const palavras = base
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[\s._-]+/)
    .map((p) => p.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean)
  if (palavras.length === 0) return ""
  const primeira = palavras[0][0]
  const ultima = palavras.length > 1 ? palavras[palavras.length - 1][0] : ""
  return (primeira + ultima).toUpperCase()
}
