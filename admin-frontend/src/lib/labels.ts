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

export function rotuloMarca(marca: string): string {
  return MARCA_LABELS[marca] ?? marca
}

export function rotuloFamilia(familia: string): string {
  return FAMILIA_LABELS[familia as Familia] ?? familia
}
