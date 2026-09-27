import { useState } from "react"
import type { FormEvent } from "react"
import { Show, SignUp, useClerk } from "@clerk/tanstack-react-start"
import { createFileRoute, Link, Navigate } from "@tanstack/react-router"
import { useAction, useQuery } from "convex/react"
import { Check } from "lucide-react"

import { api } from "@convex/_generated/api"
import { normalizarNif, validarNif } from "@convex/lib/nif"
import {
  CartaoAuth,
  LIGACAO_AUTH,
  LinhaAuth,
  PaginaAuth,
} from "@/components/auth/cartao-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  caminhoSeguroDeRegresso,
  comRegresso,
  rotuloDeRegresso,
} from "@/lib/auth-gate"
import { cn } from "@/lib/utils"

/**
 * Company registration in two visible steps: the contact person's account
 * (Clerk `<SignUp>`), then the company itself. Submitting the company ends on
 * a confirmation screen; the request is reviewed by the office and the
 * company stays `pendente` until then. `?return=` survives both steps.
 */
export const Route = createFileRoute("/_minimal/registo")({
  validateSearch: (search: Record<string, unknown>): { return?: string } => ({
    return: caminhoSeguroDeRegresso(search.return),
  }),
  component: RegistoPage,
})

function RegistoPage() {
  const { return: regresso } = Route.useSearch()

  return (
    <PaginaAuth>
      <Show when="signed-out">
        <CartaoAuth>
          <Passos passo={1} />
          <SignUp
            routing="hash"
            signInUrl={comRegresso("/entrar", regresso)}
            fallbackRedirectUrl={comRegresso("/registo", regresso)}
            forceRedirectUrl={comRegresso("/registo", regresso)}
          />
        </CartaoAuth>
        <LinhaAuth>
          Já tem conta?{" "}
          <Link
            to="/entrar"
            search={regresso ? { return: regresso } : {}}
            className={LIGACAO_AUTH}
          >
            Entrar
          </Link>
        </LinhaAuth>
      </Show>
      <Show when="signed-in">
        <PassoEmpresa regresso={regresso} />
      </Show>
    </PaginaAuth>
  )
}

/* ------------------------------------------------------------------------ */
/* Step indicator                                                            */
/* ------------------------------------------------------------------------ */

const PASSOS = ["Conta", "Empresa"] as const

/** `passo` is the active step; 3 means both are done (confirmation). */
function Passos({ passo }: { passo: 1 | 2 | 3 }) {
  return (
    <ol
      aria-label="Passos do registo"
      className="mb-6 flex items-center gap-3 text-sm"
    >
      {PASSOS.map((label, i) => {
        const numero = i + 1
        const estado =
          numero < passo ? "feito" : numero === passo ? "activo" : "seguinte"
        return (
          <li key={label} className="contents">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1",
                  estado === "seguinte" ? "bg-border" : "bg-primary"
                )}
              />
            )}
            <span
              aria-current={estado === "activo" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 font-medium",
                estado === "seguinte"
                  ? "text-muted-foreground"
                  : "text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                  estado === "seguinte"
                    ? "border border-input"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {estado === "feito" ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  numero
                )}
              </span>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------------ */
/* Step 2: the company                                                       */
/* ------------------------------------------------------------------------ */

function PassoEmpresa({ regresso }: { regresso: string | undefined }) {
  const [enviado, setEnviado] = useState<string | null>(null)
  // `null` while Convex has not picked the Clerk session up yet.
  const vista = useQuery(api.empresas.minha)

  if (enviado !== null) {
    return (
      <CartaoAuth>
        <Passos passo={3} />
        <Concluido nomeLegal={enviado} regresso={regresso} />
      </CartaoAuth>
    )
  }
  if (vista === undefined || vista === null) {
    return (
      <CartaoAuth>
        <Passos passo={2} />
        <div className="flex flex-col gap-4" aria-busy>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CartaoAuth>
    )
  }
  if (vista.kind === "empresa" || vista.kind === "sem-empresa") {
    return <Navigate to="/empresa" />
  }
  return (
    <CartaoAuth>
      <Passos passo={2} />
      <FormularioEmpresa onEnviado={setEnviado} />
    </CartaoAuth>
  )
}

function FormularioEmpresa({
  onEnviado,
}: {
  onEnviado: (nomeLegal: string) => void
}) {
  const { setActive } = useClerk()
  const registar = useAction(api.empresasActions.registar)
  const [erro, setErro] = useState<string | null>(null)
  const [nifErro, setNifErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  function validarCampoNif(valor: string): boolean {
    const ok = valor.trim() === "" || validarNif(valor)
    setNifErro(ok ? null : "NIF inválido. Confirme os 9 dígitos.")
    return ok
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const data = new FormData(e.currentTarget)
    const nif = normalizarNif(String(data.get("nif") ?? ""))
    if (!validarNif(nif)) {
      setNifErro("NIF inválido. Confirme os 9 dígitos.")
      return
    }
    const nomeLegal = String(data.get("nomeLegal") ?? "").trim()
    const certif = String(data.get("certifNumero") ?? "").trim()
    setAEnviar(true)
    try {
      const resultado = await registar({
        nomeLegal,
        nif,
        morada: String(data.get("morada") ?? ""),
        email: String(data.get("email") ?? ""),
        telefone: String(data.get("telefone") ?? ""),
        certifNumero: certif === "" ? undefined : certif,
      })
      try {
        await setActive({ organization: resultado.clerkOrgId })
      } catch {
        // The environment still finds the company via registadoPor.
      }
      onEnviado(nomeLegal)
    } catch (err) {
      setErro(mensagemRegisto(err))
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex flex-col gap-4"
      noValidate={false}
    >
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Dados da empresa
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          A nossa equipa comercial analisa o pedido e avisa por email.
        </p>
      </div>
      {erro && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </p>
      )}
      <Campo
        nome="nomeLegal"
        label="Nome legal"
        autoComplete="organization"
        required
      />
      <Campo
        nome="nif"
        label="NIF"
        placeholder="509442013"
        inputMode="numeric"
        autoComplete="off"
        maxLength={11}
        required
        erro={nifErro}
        onBlur={(e) => validarCampoNif(e.currentTarget.value)}
        onChange={(e) => {
          if (nifErro) validarCampoNif(e.currentTarget.value)
        }}
      />
      <Campo
        nome="morada"
        label="Morada"
        autoComplete="street-address"
        required
      />
      <Campo
        nome="email"
        label="Email da empresa"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
      />
      <Campo
        nome="telefone"
        label="Telefone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
      />
      <Campo nome="certifNumero" label="N.º CERTIF" opcional />
      <Button
        type="submit"
        size="lg"
        disabled={aEnviar}
        className="mt-2 w-full"
      >
        {aEnviar ? "A submeter…" : "Submeter para aprovação"}
      </Button>
    </form>
  )
}

function Campo({
  nome,
  label,
  opcional,
  erro,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "name" | "id"> & {
  nome: string
  label: string
  opcional?: boolean
  erro?: string | null
}) {
  const id = `registo-${nome}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {opcional && (
          <span className="ml-1 font-normal text-muted-foreground">
            (opcional)
          </span>
        )}
      </label>
      <Input
        id={id}
        name={nome}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        {...props}
      />
      {erro && (
        <p id={`${id}-erro`} className="text-xs text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Confirmation                                                              */
/* ------------------------------------------------------------------------ */

/**
 * Both buttons are plain anchors on purpose: the session just gained an
 * organization, and a full load lets the server pick the new claims up
 * before the app shell renders.
 */
function Concluido({
  nomeLegal,
  regresso,
}: {
  nomeLegal: string
  regresso: string | undefined
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Check className="size-6" strokeWidth={2.5} />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        Empresa em aprovação
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Recebemos o pedido de{" "}
        <span className="text-foreground">{nomeLegal}</span> e a nossa equipa
        comercial vai analisá-lo. Avisamos por email. Até lá, o catálogo mostra
        o PVP e pode ir preparando a sua lista de orçamento.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <Button size="lg" render={<a href="/produtos" />} nativeButton={false}>
          Explorar o catálogo
        </Button>
        {regresso && (
          <Button
            size="lg"
            variant="outline"
            render={<a href={regresso} />}
            nativeButton={false}
          >
            {rotuloDeRegresso(regresso)}
          </Button>
        )}
      </div>
    </div>
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
