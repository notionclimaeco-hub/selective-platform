// Shared display labels for the admin UI. Keep in sync with convex/schema.ts
// (FAMILIAS + estadoValidator). `marca` is a free string in v2, so its label
// map falls back to the raw slug.

import type { Fonte } from "@/lib/imagens-estado"

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

export type EstadoAprovacao = "pendente" | "aprovada" | "rejeitada" | "suspensa"

export const ESTADO_APROVACAO_LABELS: Record<EstadoAprovacao, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  suspensa: "Suspensa",
}

export const ESTADOS_APROVACAO = Object.keys(
  ESTADO_APROVACAO_LABELS
) as Array<EstadoAprovacao>

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

// --- Taxonomy dimensions (mirrors client-frontend/src/lib/catalogo.ts) -------

export const SEGMENTO_LABELS: Record<string, string> = {
  domestico: "Doméstico",
  comercial: "Comercial",
  industrial: "Industrial",
}

export const SISTEMA_LABELS: Record<string, string> = {
  "mono-split": "Mono-split",
  "multi-split": "Multi-split",
  vrf: "VRF",
  rooftop: "Rooftop",
  monobloco: "Monobloco",
  bibloco: "Bibloco",
}

export const COMPONENTE_LABELS: Record<string, string> = {
  conjunto: "Conjunto",
  "unidade-interior": "Unidade interior",
  "unidade-exterior": "Unidade exterior",
  deposito: "Depósito",
  acessorio: "Acessório",
  comando: "Comando",
}

export const TIPO_UNIDADE_LABELS: Record<string, string> = {
  mural: "Mural",
  cassete: "Cassete",
  "cassete-1-via": "Cassete 1 via",
  "cassete-4-vias": "Cassete 4 vias",
  "cassete-8-vias": "Cassete 8 vias",
  "mini-cassete": "Mini-cassete",
  conduta: "Conduta",
  "conduta-baixa-pressao": "Conduta baixa pressão",
  "conduta-media-pressao": "Conduta média pressão",
  "conduta-alta-pressao": "Conduta alta pressão",
  "chao-teto": "Chão/teto",
  consola: "Consola",
  coluna: "Coluna",
  portatil: "Portátil",
  exterior: "Unidade exterior",
  chiller: "Chiller",
  rooftop: "Rooftop",
  uta: "UTA",
  vmc: "VMC",
  "recuperador-de-calor": "Recuperador de calor",
  "cortina-de-ar": "Cortina de ar",
  purificador: "Purificador",
  deposito: "Depósito",
  "monobloco-aqs": "Monobloco AQS",
  "modulo-hidraulico": "Módulo hidráulico",
  integrada: "Integrada",
  armario: "Armário",
  interface: "Interface",
  comando: "Comando",
  acessorio: "Acessório",
  kit: "Kit",
  outro: "Outro",
}

function deslug(valor: string): string {
  const texto = valor.replace(/-/g, " ")
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function rotuloSegmento(valor: string): string {
  return SEGMENTO_LABELS[valor] ?? deslug(valor)
}

export function rotuloSistema(valor: string): string {
  return SISTEMA_LABELS[valor] ?? deslug(valor)
}

export function rotuloComponente(valor: string): string {
  return COMPONENTE_LABELS[valor] ?? deslug(valor)
}

export function rotuloTipoUnidade(valor: string): string {
  return TIPO_UNIDADE_LABELS[valor] ?? deslug(valor)
}

// --- Import runs (#41) ------------------------------------------------------

export type EstadoImportacao =
  "a-extrair" | "em-revisao" | "a-promover" | "aprovada" | "rejeitada"

export const ESTADO_IMPORTACAO_LABELS: Record<EstadoImportacao, string> = {
  "a-extrair": "A extrair",
  "em-revisao": "Em revisão",
  "a-promover": "A promover",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
}

export type Diff = "novo" | "alterado" | "igual"

export const DIFF_LABELS: Record<Diff, string> = {
  novo: "Novo",
  alterado: "Preço alterado",
  igual: "Igual",
}

// --- Image candidates (imagens na revisão) ----------------------------------

export const FONTE_LABELS: Record<Fonte, string> = {
  site: "Site",
  megaclima: "Megaclima",
  web: "Web",
  pdf: "PDF",
  upload: "Upload",
  recorte: "Recortes",
}

export const FONTES = Object.keys(FONTE_LABELS) as Array<Fonte>

export function rotuloFonte(fonte: Fonte): string {
  return FONTE_LABELS[fonte]
}

const DATA_HORA = new Intl.DateTimeFormat("pt-PT", {
  dateStyle: "short",
  timeStyle: "short",
})

export function dataHora(ms: number): string {
  return DATA_HORA.format(new Date(ms))
}

// --- Marker tones (price-table redesign) --------------------------------------
// State is shown as `<Marcador tom=…>` (components/ui/tabela.tsx): a square
// swatch + the word.

export type Tom =
  "neutro" | "aviso" | "progresso" | "feito" | "perigo" | "inativo"

export const ESTADO_TOM: Record<Estado, Tom> = {
  rascunho: "aviso",
  publicado: "feito",
  descontinuado: "inativo",
}

export const ESTADO_APROVACAO_TOM: Record<EstadoAprovacao, Tom> = {
  pendente: "aviso",
  aprovada: "feito",
  rejeitada: "perigo",
  suspensa: "inativo",
}

export const ESTADO_IMPORTACAO_TOM: Record<EstadoImportacao, Tom> = {
  "a-extrair": "inativo",
  "em-revisao": "aviso",
  "a-promover": "progresso",
  aprovada: "feito",
  rejeitada: "perigo",
}

export const DIFF_TOM: Record<Diff, Tom> = {
  novo: "feito",
  alterado: "aviso",
  igual: "inativo",
}
