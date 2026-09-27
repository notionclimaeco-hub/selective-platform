import { useState } from "react"
import type { FormEvent } from "react"
import { Show, SignUp, useClerk, useUser } from "@clerk/tanstack-react-start"
import { createFileRoute, Navigate } from "@tanstack/react-router"
import { useAction, useQuery } from "convex/react"
import { Check } from "lucide-react"

import { api } from "@convex/_generated/api"
import { normalizarNif, validarNif } from "@convex/lib/nif"
import {
  CartaoAuth,
  PaginaAuth,
  TituloAuth,
} from "@/components/auth/cartao-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  caminhoSeguroDeRegresso,
  comRegresso,
  rotuloDeRegresso,
} from "@/lib/auth-gate"
import {
  comporMorada,
  erroDoCampo,
  formatarCodigoPostal,
  normalizarTelefone,
} from "@/lib/registo-validacao"
import type { CampoEmpresa, ValoresEmpresa } from "@/lib/registo-validacao"
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
        <Passos passo={1} />
        <CartaoAuth>
          <SignUp
            routing="hash"
            signInUrl={comRegresso("/entrar", regresso)}
            fallbackRedirectUrl={comRegresso("/registo", regresso)}
            forceRedirectUrl={comRegresso("/registo", regresso)}
          />
        </CartaoAuth>
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

/**
 * `passo` is the active step; 3 means both are done (confirmation). Sits
 * between the mark and the card, so the card starts with the step's title.
 */
function Passos({ passo }: { passo: 1 | 2 | 3 }) {
  return (
    <ol
      aria-label="Passos do registo"
      className="mb-5 flex items-center justify-center gap-2.5 text-sm"
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
                  "h-px w-8",
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
                    ? "border border-input bg-card"
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
      <>
        <Passos passo={3} />
        <CartaoAuth>
          <Concluido nomeLegal={enviado} regresso={regresso} />
        </CartaoAuth>
      </>
    )
  }
  if (vista === undefined || vista === null) {
    return (
      <>
        <Passos passo={2} />
        <CartaoAuth>
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CartaoAuth>
      </>
    )
  }
  if (vista.kind === "empresa" || vista.kind === "sem-empresa") {
    return <Navigate to="/empresa" />
  }
  return (
    <>
      <Passos passo={2} />
      <CartaoAuth>
        <FormularioEmpresa onEnviado={setEnviado} />
      </CartaoAuth>
    </>
  )
}

function FormularioEmpresa({
  onEnviado,
}: {
  onEnviado: (nomeLegal: string) => void
}) {
  const { setActive } = useClerk()
  const { user } = useUser()
  const registar = useAction(api.empresasActions.registar)
  const [erro, setErro] = useState<string | null>(null)
  const [erros, setErros] = useState<Partial<Record<CampoEmpresa, string>>>({})
  const [aEnviar, setAEnviar] = useState(false)

  function erroDe(campo: CampoEmpresa, valor: string): string | null {
    if (campo === "nif") {
      if (valor.trim() === "") return "Campo obrigatório."
      return validarNif(valor) ? null : "NIF inválido. Confirme os 9 dígitos."
    }
    return erroDoCampo(campo, valor)
  }

  /** Validate one field and store its message (null clears it). */
  function validar(campo: CampoEmpresa, valor: string): boolean {
    const mensagem = erroDe(campo, valor)
    setErros((e) => ({ ...e, [campo]: mensagem ?? undefined }))
    return mensagem === null
  }

  /** Blur validates; once a field is flagged, typing re-validates live. */
  function eventos(campo: CampoEmpresa) {
    return {
      onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
        validar(campo, e.currentTarget.value),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (erros[campo]) validar(campo, e.currentTarget.value)
      },
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const form = e.currentTarget
    const data = new FormData(form)
    const valores = Object.fromEntries(
      CAMPOS.map((c) => [c, String(data.get(c) ?? "")])
    ) as ValoresEmpresa

    const novosErros: Partial<Record<CampoEmpresa, string>> = {}
    for (const campo of CAMPOS) {
      const mensagem = erroDe(campo, valores[campo])
      if (mensagem) novosErros[campo] = mensagem
    }
    setErros(novosErros)
    const primeiro = CAMPOS.find((c) => novosErros[c])
    if (primeiro) {
      form.querySelector<HTMLInputElement>(`#registo-${primeiro}`)?.focus()
      return
    }

    const nomeLegal = valores.nomeLegal.trim()
    const certif = valores.certifNumero.trim()
    setAEnviar(true)
    try {
      const resultado = await registar({
        nomeLegal,
        nif: normalizarNif(valores.nif),
        morada: comporMorada(valores),
        email: valores.email.trim(),
        telefone: normalizarTelefone(valores.telefone),
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
      noValidate
    >
      <TituloAuth titulo="Dados da empresa" />
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
        erro={erros.nomeLegal}
        {...eventos("nomeLegal")}
      />
      <Campo
        nome="nif"
        label="NIF"
        placeholder="509442013"
        inputMode="numeric"
        autoComplete="off"
        maxLength={11}
        erro={erros.nif}
        {...eventos("nif")}
      />
      <Campo
        nome="rua"
        label="Rua"
        autoComplete="address-line1"
        erro={erros.rua}
        {...eventos("rua")}
      />
      <Campo
        nome="numero"
        label="Número, lote ou andar"
        placeholder="9, Loja 3"
        autoComplete="address-line2"
        erro={erros.numero}
        {...eventos("numero")}
      />
      <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3">
        <Campo
          nome="codigoPostal"
          label="Código postal"
          placeholder="2605-652"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={8}
          erro={erros.codigoPostal}
          onBlur={(e) => validar("codigoPostal", e.currentTarget.value)}
          onChange={(e) => {
            // Insert the hyphen for the user: "2605652" → "2605-652".
            const formatado = formatarCodigoPostal(e.currentTarget.value)
            if (formatado !== e.currentTarget.value) {
              e.currentTarget.value = formatado
            }
            if (erros.codigoPostal) validar("codigoPostal", formatado)
          }}
        />
        <Campo
          nome="localidade"
          label="Localidade"
          placeholder="Belas"
          autoComplete="address-level2"
          erro={erros.localidade}
          {...eventos("localidade")}
        />
      </div>
      {/* Billing contact of the company (invoices, payment links), stored on
          the company and shown to staff. Usually the registrant's own address,
          so it starts as the account email and stays editable. */}
      <Campo
        nome="email"
        label="Email de faturação"
        dica="Para faturas e links de pagamento."
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={user?.primaryEmailAddress?.emailAddress ?? ""}
        erro={erros.email}
        {...eventos("email")}
      />
      <Campo
        nome="telefone"
        label="Telefone"
        placeholder="912 345 678"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        erro={erros.telefone}
        {...eventos("telefone")}
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

const CAMPOS: CampoEmpresa[] = [
  "nomeLegal",
  "nif",
  "rua",
  "numero",
  "codigoPostal",
  "localidade",
  "email",
  "telefone",
  "certifNumero",
]

function Campo({
  nome,
  label,
  opcional,
  dica,
  erro,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "name" | "id"> & {
  nome: CampoEmpresa
  label: string
  opcional?: boolean
  dica?: string
  erro?: string | null
}) {
  const id = `registo-${nome}`
  const descritoPor = [erro && `${id}-erro`, dica && `${id}-dica`]
    .filter(Boolean)
    .join(" ")
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
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
        aria-describedby={descritoPor || undefined}
        {...props}
      />
      {erro ? (
        <p id={`${id}-erro`} className="text-xs text-destructive">
          {erro}
        </p>
      ) : (
        dica && (
          <p id={`${id}-dica`} className="text-xs text-muted-foreground">
            {dica}
          </p>
        )
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
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Empresa em aprovação
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pedido de <span className="text-foreground">{nomeLegal}</span> recebido.
        Avisamos por email quando estiver aprovado.
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
