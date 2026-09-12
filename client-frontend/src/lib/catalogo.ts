// Shared display labels + helpers for catalog data (Convex stores slugs).

import {
  AirVent,
  Droplets,
  Fan,
  Package,
  Snowflake,
  SlidersHorizontal,
  ThermometerSun,
  Wind,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

// Product family (schema v2 `familia`). Stored as a free string in Convex, but
// the catalog only surfaces this known set. Keep in sync with FAMILIAS in
// convex/schema.ts.
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

export const FAMILIA_LABELS: Record<Familia, string> = {
  "ar-condicionado": "Ar condicionado",
  "bombas-de-calor": "Bombas de calor",
  aqs: "Águas quentes sanitárias",
  ventilacao: "Ventilação",
  chillers: "Chillers",
  ventiloconvectores: "Ventiloconvectores",
  "cortinas-de-ar": "Cortinas de ar",
  "purificadores-de-ar": "Purificadores de ar",
  "acessorios-e-controlo": "Acessórios e controlo",
  outros: "Outros",
}

export const FAMILIAS = Object.keys(FAMILIA_LABELS) as Array<Familia>

// Marca is a free string in v2. We keep a label map for the known brands and
// fall back to the raw slug for anything else.
export const MARCA_LABELS: Record<string, string> = {
  mitsubishi: "Mitsubishi Electric",
  daikin: "Daikin",
  nipon: "Nipon",
  hisense: "Hisense",
  midea: "Midea",
}

export const MARCAS = Object.keys(MARCA_LABELS)

// --- Facet dimensions -----------------------------------------------------

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
  conjunto: "Conjunto completo",
  "unidade-interior": "Unidade interior",
  "unidade-exterior": "Unidade exterior",
  deposito: "Depósito",
  acessorio: "Acessório",
  comando: "Comando",
}

// `tipoUnidade` is a free string in Convex; label the values the catalog
// actually uses and fall back to a de-slugified version for anything new.
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

export const ORDENACOES = [
  { valor: "relevancia", rotulo: "Mais relevantes" },
  { valor: "preco-asc", rotulo: "Preço: menor primeiro" },
  { valor: "preco-desc", rotulo: "Preço: maior primeiro" },
  { valor: "nome", rotulo: "Nome (A-Z)" },
  { valor: "recentes", rotulo: "Novidades" },
] as const

export type Ordenacao = (typeof ORDENACOES)[number]["valor"]

export function rotuloOrdenacao(valor: Ordenacao): string {
  return ORDENACOES.find((o) => o.valor === valor)?.rotulo ?? valor
}

// Familia -> icon, shared by the showcase cards and the product gallery
// placeholder so both stay visually consistent.
export const FAMILIA_ICONS: Record<string, LucideIcon> = {
  "ar-condicionado": AirVent,
  "bombas-de-calor": ThermometerSun,
  aqs: Droplets,
  ventilacao: Wind,
  chillers: Snowflake,
  ventiloconvectores: Fan,
  "cortinas-de-ar": Wind,
  "purificadores-de-ar": Wind,
  "acessorios-e-controlo": SlidersHorizontal,
  outros: Package,
}

export function iconeFamilia(familia: string): LucideIcon {
  return FAMILIA_ICONS[familia] ?? AirVent
}

export function rotuloFamilia(familia: string): string {
  return FAMILIA_LABELS[familia as Familia] ?? familia
}

export function rotuloMarca(marca: string): string {
  return MARCA_LABELS[marca] ?? marca
}

// Rounded EUR (no cents) — used on cards where space is tight.
export const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

// Exact EUR (2 decimals) — used on the product detail page.
export const eurExato = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
