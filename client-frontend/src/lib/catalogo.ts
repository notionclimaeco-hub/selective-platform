// Shared display labels + helpers for catalog data (Convex stores slugs).

import {
  AirVent,
  Droplets,
  Fan,
  ThermometerSun,
  Wind,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const CATEGORIA_LABELS: Record<string, string> = {
  "ar-condicionado": "Ar condicionado",
  "bombas-calor": "Bombas de calor",
  ventiloconvetores: "Ventiloconvetores",
  vmc: "Ventilação (VMC)",
  aqs: "Águas quentes sanitárias",
}

export const MARCA_LABELS: Record<string, string> = {
  mitsubishi: "Mitsubishi Electric",
  nipon: "Nipon",
  hisense: "Hisense",
  midea: "Midea",
  daikin: "Daikin",
}

// Category -> icon, shared by the showcase cards and the product gallery
// placeholder so both stay visually consistent.
export const CATEGORIA_ICONS: Record<string, LucideIcon> = {
  "ar-condicionado": AirVent,
  "bombas-calor": ThermometerSun,
  ventiloconvetores: Fan,
  vmc: Wind,
  aqs: Droplets,
}

export function iconeCategoria(categoria: string): LucideIcon {
  return CATEGORIA_ICONS[categoria] ?? AirVent
}

export function rotuloCategoria(categoria: string): string {
  return CATEGORIA_LABELS[categoria] ?? categoria
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
