/**
 * Client-side validation for the company form on /registo. The backend keeps
 * the address as one string (`installerCompanies.morada`), so the separate
 * fields are composed with `comporMorada` before submit.
 */

export type CampoEmpresa =
  | "nomeLegal"
  | "nif"
  | "rua"
  | "numero"
  | "codigoPostal"
  | "localidade"
  | "email"
  | "telefone"
  | "certifNumero"

export type ValoresEmpresa = Record<CampoEmpresa, string>

/** "2605652" → "2605-652" while typing; leaves anything else alone. */
export function formatarCodigoPostal(input: string): string {
  const digitos = input.replace(/\D/g, "").slice(0, 7)
  return digitos.length > 4
    ? `${digitos.slice(0, 4)}-${digitos.slice(4)}`
    : digitos
}

export function validarCodigoPostal(input: string): boolean {
  return /^\d{4}-\d{3}$/.test(input.trim())
}

/** Strip spaces, dots and hyphens; keep a leading "+". */
export function normalizarTelefone(input: string): string {
  return input.replace(/[\s.\-()]/g, "")
}

/** Portuguese numbers: 9 digits starting with 2 (fixed) or 9 (mobile), with or without +351 / 00351. */
export function validarTelefone(input: string): boolean {
  const n = normalizarTelefone(input)
  return /^(?:\+351|00351)?[29]\d{8}$/.test(n)
}

export function validarEmail(input: string): boolean {
  const e = input.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
}

/** "Rua X, 12 3.º Esq, 2605-652 Belas" */
export function comporMorada(v: {
  rua: string
  numero: string
  codigoPostal: string
  localidade: string
}): string {
  return `${v.rua.trim()}, ${v.numero.trim()}, ${v.codigoPostal.trim()} ${v.localidade.trim()}`
}

const OBRIGATORIO = "Campo obrigatório."

/**
 * Message for one field, or null when it is fine. `nif` is validated by
 * `@convex/lib/nif` in the form itself (shared with the backend).
 */
export function erroDoCampo(
  campo: Exclude<CampoEmpresa, "nif">,
  valor: string
): string | null {
  const v = valor.trim()
  switch (campo) {
    case "nomeLegal":
      if (v === "") return OBRIGATORIO
      return v.length < 2 ? "Indique o nome legal completo." : null
    case "rua":
      if (v === "") return OBRIGATORIO
      return v.length < 3 ? "Indique a rua." : null
    case "numero":
      return v === "" ? OBRIGATORIO : null
    case "codigoPostal":
      if (v === "") return OBRIGATORIO
      return validarCodigoPostal(v) ? null : "Formato 1234-567."
    case "localidade":
      if (v === "") return OBRIGATORIO
      return v.length < 2 ? "Indique a localidade." : null
    case "email":
      if (v === "") return OBRIGATORIO
      return validarEmail(v) ? null : "Email inválido."
    case "telefone":
      if (v === "") return OBRIGATORIO
      return validarTelefone(v) ? null : "9 dígitos, por exemplo 912 345 678."
    case "certifNumero":
      return null
  }
}
