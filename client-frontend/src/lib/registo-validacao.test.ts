import { describe, expect, it } from "vitest"

import {
  comporMorada,
  erroDoCampo,
  formatarCodigoPostal,
  normalizarTelefone,
  validarCodigoPostal,
  validarEmail,
  validarTelefone,
} from "./registo-validacao"

describe("código postal", () => {
  it("inserts the hyphen after four digits while typing", () => {
    expect(formatarCodigoPostal("2605")).toBe("2605")
    expect(formatarCodigoPostal("26056")).toBe("2605-6")
    expect(formatarCodigoPostal("2605652")).toBe("2605-652")
    expect(formatarCodigoPostal("2605-652")).toBe("2605-652")
    expect(formatarCodigoPostal("2605-6529")).toBe("2605-652")
  })

  it("accepts only NNNN-NNN", () => {
    expect(validarCodigoPostal("2605-652")).toBe(true)
    expect(validarCodigoPostal("2605652")).toBe(false)
    expect(validarCodigoPostal("260-5652")).toBe(false)
    expect(validarCodigoPostal("")).toBe(false)
  })
})

describe("telefone", () => {
  it("normalises separators and keeps the plus", () => {
    expect(normalizarTelefone("+351 912 345 678")).toBe("+351912345678")
    expect(normalizarTelefone("21-123.45 67")).toBe("211234567")
  })

  it("accepts Portuguese fixed and mobile numbers", () => {
    expect(validarTelefone("912345678")).toBe(true)
    expect(validarTelefone("912 345 678")).toBe(true)
    expect(validarTelefone("+351 219 876 543")).toBe(true)
    expect(validarTelefone("00351912345678")).toBe(true)
    expect(validarTelefone("812345678")).toBe(false)
    expect(validarTelefone("91234567")).toBe(false)
    expect(validarTelefone("9123456789")).toBe(false)
  })
})

describe("email", () => {
  it("needs a user, a host and a TLD", () => {
    expect(validarEmail("geral@instalclima.pt")).toBe(true)
    expect(validarEmail("geral@instalclima")).toBe(false)
    expect(validarEmail("geral instalclima.pt")).toBe(false)
  })
})

describe("comporMorada", () => {
  it("joins the fields the way CTT writes an address", () => {
    expect(
      comporMorada({
        rua: " Rua Dona Dulce de Aragão ",
        numero: "9, Loja 3",
        codigoPostal: "2605-652",
        localidade: "Belas",
      })
    ).toBe("Rua Dona Dulce de Aragão, 9, Loja 3, 2605-652 Belas")
  })
})

describe("erroDoCampo", () => {
  it("flags empty required fields", () => {
    expect(erroDoCampo("nomeLegal", " ")).toBe("Campo obrigatório.")
    expect(erroDoCampo("rua", "")).toBe("Campo obrigatório.")
    expect(erroDoCampo("numero", "")).toBe("Campo obrigatório.")
    expect(erroDoCampo("codigoPostal", "")).toBe("Campo obrigatório.")
    expect(erroDoCampo("localidade", "")).toBe("Campo obrigatório.")
    expect(erroDoCampo("email", "")).toBe("Campo obrigatório.")
    expect(erroDoCampo("telefone", "")).toBe("Campo obrigatório.")
  })

  it("explains the expected format", () => {
    expect(erroDoCampo("codigoPostal", "2605652")).toBe("Formato 1234-567.")
    expect(erroDoCampo("email", "x@y")).toBe("Email inválido.")
    expect(erroDoCampo("telefone", "123")).toBe(
      "9 dígitos, por exemplo 912 345 678."
    )
  })

  it("passes good values and the optional CERTIF", () => {
    expect(erroDoCampo("nomeLegal", "Instalclima, Lda.")).toBeNull()
    expect(erroDoCampo("rua", "Rua A")).toBeNull()
    expect(erroDoCampo("numero", "s/n")).toBeNull()
    expect(erroDoCampo("codigoPostal", "1000-001")).toBeNull()
    expect(erroDoCampo("localidade", "Lisboa")).toBeNull()
    expect(erroDoCampo("email", "geral@instalclima.pt")).toBeNull()
    expect(erroDoCampo("telefone", "+351 912 345 678")).toBeNull()
    expect(erroDoCampo("certifNumero", "")).toBeNull()
  })
})
