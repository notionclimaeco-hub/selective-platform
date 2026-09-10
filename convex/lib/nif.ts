/**
 * Portuguese NIF (9 digits) with the official check-digit algorithm.
 *
 * Weights 9..2 on the first eight digits; check = 11 − (sum % 11), then
 * 10 and 11 both collapse to 0. First digit must be 1, 2, 3, 5, 6, 8, or 9.
 */

const NIF_WEIGHTS = [9, 8, 7, 6, 5, 4, 3, 2] as const;
const NIF_FIRST_DIGITS = new Set(["1", "2", "3", "5", "6", "8", "9"]);

/** Strip spaces and hyphens; leave only digits. */
export function normalizarNif(input: string): string {
  return input.replace(/[\s-]/g, "");
}

export function validarNif(input: string): boolean {
  const nif = normalizarNif(input);
  if (!/^\d{9}$/.test(nif)) {
    return false;
  }
  const first = nif[0];
  if (first === undefined || !NIF_FIRST_DIGITS.has(first)) {
    return false;
  }

  let soma = 0;
  for (let i = 0; i < 8; i++) {
    const digit = nif[i];
    const weight = NIF_WEIGHTS[i];
    if (digit === undefined || weight === undefined) {
      return false;
    }
    soma += Number(digit) * weight;
  }

  const resto = soma % 11;
  const esperado = resto < 2 ? 0 : 11 - resto;
  return Number(nif[8]) === esperado;
}
