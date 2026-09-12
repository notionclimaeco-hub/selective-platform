import { useState, type FormEvent } from "react"
import { Show, SignUp, useClerk } from "@clerk/tanstack-react-start"
import { createFileRoute, Link, Navigate } from "@tanstack/react-router"
import { useAction, useQuery } from "convex/react"

import { api } from "@convex/_generated/api"
import { normalizarNif, validarNif } from "@convex/lib/nif"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Button } from "@/components/ui/button"

const inputCls =
  "h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

export const Route = createFileRoute("/registo")({ component: RegistoPage })

function RegistoPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-12 sm:px-6">
        <p className="text-sm font-medium text-primary">Área de Cliente</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Registar empresa
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie a conta da pessoa de contacto e, em seguida, o perfil da empresa.
          A aprovação é feita pela nossa equipa comercial.
        </p>
        <Show when="signed-out">
          <div className="mt-8 flex flex-col items-center">
            <SignUp
              routing="hash"
              signInUrl="/entrar"
              fallbackRedirectUrl="/registo"
              forceRedirectUrl="/registo"
            />
            <p className="mt-6 text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link
                to="/entrar"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Entrar
              </Link>
            </p>
          </div>
        </Show>
        <Show when="signed-in">
          <FormularioEmpresa />
        </Show>
      </main>
      <SiteFooter />
    </div>
  )
}

function FormularioEmpresa() {
  const { setActive } = useClerk()
  const vista = useQuery(api.empresas.minha)
  const registar = useAction(api.empresasActions.registar)
  const [erro, setErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  if (vista === undefined) {
    return <p className="mt-8 text-sm text-muted-foreground">A carregar…</p>
  }
  if (vista?.kind === "empresa" || vista?.kind === "sem-empresa") {
    return <Navigate to="/conta" />
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const data = new FormData(e.currentTarget)
    const nif = normalizarNif(String(data.get("nif") ?? ""))
    if (!validarNif(nif)) {
      setErro("NIF inválido. Confirme os 9 dígitos.")
      return
    }
    const certif = String(data.get("certifNumero") ?? "").trim()
    setAEnviar(true)
    try {
      const resultado = await registar({
        nomeLegal: String(data.get("nomeLegal") ?? ""),
        nif,
        morada: String(data.get("morada") ?? ""),
        email: String(data.get("email") ?? ""),
        telefone: String(data.get("telefone") ?? ""),
        certifNumero: certif === "" ? undefined : certif,
      })
      try {
        await setActive({ organization: resultado.clerkOrgId })
      } catch {
        // /conta still finds the company via registadoPor.
      }
      window.location.assign("/conta?pedido=enviado")
    } catch (err) {
      setErro(mensagemRegisto(err))
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mt-8 flex flex-col gap-4"
    >
      {erro && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      <Campo nome="nomeLegal" label="Nome legal" required />
      <Campo nome="nif" label="NIF" required placeholder="509442013" />
      <Campo nome="morada" label="Morada" required />
      <Campo nome="email" label="Email da empresa" type="email" required />
      <Campo nome="telefone" label="Telefone" type="tel" required />
      <Campo nome="certifNumero" label="N.º CERTIF (opcional)" />
      <Button type="submit" size="lg" disabled={aEnviar} className="mt-2">
        {aEnviar ? "A submeter…" : "Submeter para aprovação"}
      </Button>
    </form>
  )
}

function Campo({
  nome,
  label,
  type = "text",
  required,
  placeholder,
}: {
  nome: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        className={inputCls}
        name={nome}
        type={type}
        required={required}
        placeholder={placeholder}
      />
    </label>
  )
}

function mensagemRegisto(err: unknown): string {
  const raw = err instanceof Error ? err.message : ""
  if (raw.includes("Invalid NIF")) return "NIF inválido. Confirme os 9 dígitos."
  if (raw.includes("NIF already registered")) {
    return "Este NIF já está registado. Contacte o escritório."
  }
  if (raw.includes("already registered a company")) {
    return "Já registou uma empresa com esta conta."
  }
  if (raw.includes("Already a member")) {
    return "Esta conta já pertence a uma empresa. Vá à área de cliente."
  }
  return raw || "Não foi possível concluir o registo. Tente novamente."
}
