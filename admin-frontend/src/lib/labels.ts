// Shared display labels for the admin UI, mirroring the Convex literal unions
// (marca / categoria / estado). Keep in sync with convex/schema.ts.

export type Marca = "daikin" | "nipon" | "hisense" | "mitsubishi" | "midea"

export type Categoria =
  | "ar-condicionado"
  | "bombas-calor"
  | "aqs"
  | "vmc"
  | "ventiloconvetores"

export type Estado = "rascunho" | "publicado" | "descontinuado"

export const MARCA_LABELS: Record<Marca, string> = {
  daikin: "Daikin",
  nipon: "Nipon",
  hisense: "Hisense",
  mitsubishi: "Mitsubishi",
  midea: "Midea",
}

export const CATEGORIA_LABELS: Record<Categoria, string> = {
  "ar-condicionado": "Ar condicionado",
  "bombas-calor": "Bombas de calor",
  aqs: "AQS",
  vmc: "VMC",
  ventiloconvetores: "Ventiloconvetores",
}

export const CATEGORIAS = Object.keys(CATEGORIA_LABELS) as Array<Categoria>

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

export function rotuloMarca(marca: Marca): string {
  return MARCA_LABELS[marca]
}

export function rotuloCategoria(categoria: Categoria): string {
  return CATEGORIA_LABELS[categoria]
}
