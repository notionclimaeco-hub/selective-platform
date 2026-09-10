// Shared display labels for the admin UI. Keep in sync with convex/schema.ts
// (FAMILIAS + estadoValidator). `marca` is a free string in v2, so its label
// map falls back to the raw slug.

export const MARCA_LABELS: Record<string, string> = {
  daikin: "Daikin",
  nipon: "Nipon",
  hisense: "Hisense",
  mitsubishi: "Mitsubishi",
  midea: "Midea",
}

export type Familia =
  | "ar-condicionado"
  | "bombas-de-calor"
  | "aqs"
  | "ventilacao"
  | "chillers"
  | "ventiloconvectores"
  | "cortinas-de-ar"
  | "purificadores-de-ar"
  | "acessorios-e-controlo"
  | "outros"

export type Estado = "rascunho" | "publicado" | "descontinuado"

export const FAMILIA_LABELS: Record<Familia, string> = {
  "ar-condicionado": "Ar condicionado",
  "bombas-de-calor": "Bombas de calor",
  aqs: "AQS",
  ventilacao: "Ventilação",
  chillers: "Chillers",
  ventiloconvectores: "Ventiloconvectores",
  "cortinas-de-ar": "Cortinas de ar",
  "purificadores-de-ar": "Purificadores de ar",
  "acessorios-e-controlo": "Acessórios e controlo",
  outros: "Outros",
}

export const FAMILIAS = Object.keys(FAMILIA_LABELS) as Array<Familia>

export const ESTADO_LABELS: Record<Estado, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  descontinuado: "Descontinuado",
}

export const ESTADOS = Object.keys(ESTADO_LABELS) as Array<Estado>

export const ESTADO_CLASSES: Record<Estado, string> = {
  rascunho: "bg-amber-100 text-amber-800",
  publicado: "bg-green-100 text-green-800",
  descontinuado: "bg-muted text-muted-foreground",
}

export type EstadoAprovacao =
  | "pendente"
  | "aprovada"
  | "rejeitada"
  | "suspensa"

export const ESTADO_APROVACAO_LABELS: Record<EstadoAprovacao, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  suspensa: "Suspensa",
}

export const ESTADOS_APROVACAO = Object.keys(
  ESTADO_APROVACAO_LABELS,
) as Array<EstadoAprovacao>

export const ESTADO_APROVACAO_CLASSES: Record<EstadoAprovacao, string> = {
  pendente: "bg-amber-100 text-amber-800",
  aprovada: "bg-green-100 text-green-800",
  rejeitada: "bg-destructive/10 text-destructive",
  suspensa: "bg-muted text-muted-foreground",
}

export const TRANSICOES_APROVACAO: Record<
  EstadoAprovacao,
  Array<{ para: EstadoAprovacao; label: string; destructive?: boolean }>
> = {
  pendente: [
    { para: "aprovada", label: "Aprovar" },
    { para: "rejeitada", label: "Rejeitar", destructive: true },
  ],
  aprovada: [{ para: "suspensa", label: "Suspender", destructive: true }],
  rejeitada: [{ para: "aprovada", label: "Aprovar" }],
  suspensa: [{ para: "aprovada", label: "Repor aprovação" }],
}

const EUR = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
})

export function eurosDeCents(cents: number): string {
  return EUR.format(cents / 100)
}

export function rotuloMarca(marca: string): string {
  return MARCA_LABELS[marca] ?? marca
}

export function rotuloFamilia(familia: string): string {
  return FAMILIA_LABELS[familia as Familia] ?? familia
}
