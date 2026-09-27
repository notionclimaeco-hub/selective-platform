import { ptPT } from "@clerk/localizations"
import type { ClerkProvider } from "@clerk/tanstack-react-start"
import type { ComponentProps } from "react"

type Appearance = NonNullable<
  ComponentProps<typeof ClerkProvider>["appearance"]
>
type Localization = NonNullable<
  ComponentProps<typeof ClerkProvider>["localization"]
>

/**
 * One Clerk `appearance` for the whole client: `<SignIn>`, `<SignUp>`,
 * `UserButton`, `OrganizationSwitcher` and the profile modals all read it from
 * `ClerkProvider`. Values point at the tokens in `styles.css`, so Clerk's UI
 * follows the theme without a second palette.
 *
 * Clerk's stylesheet outranks Tailwind utilities, so element overrides are CSS
 * objects rather than class names.
 */
const ANEL = "0 0 0 3px color-mix(in oklch, var(--ring), transparent 75%)"

/**
 * Clerk draws field borders as a translucent box-shadow under
 * `[data-variant="default"]`, which outranks a plain element class. The
 * doubled `&&` keeps these rules on top: hairline border, darker on hover,
 * ring on focus, destructive on error.
 */
const CAMPO = {
  backgroundColor: "var(--background)",
  borderRadius: "var(--radius-lg)",
  minHeight: "2.5rem",
  "&&": {
    borderWidth: 0,
    boxShadow: "0 0 0 1px var(--input)",
  },
  "&&:hover": {
    boxShadow:
      "0 0 0 1px color-mix(in oklch, var(--input), var(--foreground) 15%)",
  },
  "&&:focus-within, &&:focus-visible, &&[data-focus-within='true']": {
    boxShadow: `0 0 0 1px var(--ring), ${ANEL}`,
  },
  "&&[data-feedback='error']": {
    boxShadow: "0 0 0 1px var(--destructive)",
  },
  "&&[data-feedback='error']:focus-within": {
    boxShadow:
      "0 0 0 1px var(--destructive), 0 0 0 3px color-mix(in oklch, var(--destructive), transparent 80%)",
  },
}

/** Clerk's solid button rules carry two attribute selectors; `&&&` outranks them. */
const BOTAO_PRIMARIO = {
  minHeight: "2.5rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  "&&&[data-variant='solid']": { boxShadow: "none", backgroundImage: "none" },
  "&&&[data-variant='solid']:hover": {
    backgroundColor: "color-mix(in oklch, var(--primary), black 10%)",
  },
  "&&&[data-variant='solid']:focus-visible": { boxShadow: ANEL },
}

/**
 * `<SignIn>` / `<SignUp>` sit inside our own auth card (`CartaoAuth`), so the
 * Clerk card loses its box: no border, no shadow, no padding, full width.
 */
const EMBUTIDO: NonNullable<Appearance["elements"]> = {
  rootBox: { width: "100%" },
  // Clerk's cardBox clips its overflow, which cuts the side edges of the
  // inputs' box-shadow border and focus ring; keep it visible.
  cardBox: {
    width: "100%",
    maxWidth: "none",
    boxShadow: "none",
    border: "none",
    borderRadius: 0,
    "&&": { overflow: "visible" },
  },
  card: { padding: 0, boxShadow: "none", border: "none", gap: "1.5rem" },
  // Clerk's header is the card title: it changes per step (code, password).
  header: { gap: "0.375rem" },
  headerTitle: {
    fontSize: "1.5rem",
    lineHeight: "2rem",
    fontWeight: 600,
    letterSpacing: "-0.025em",
  },
  headerSubtitle: { color: "var(--muted-foreground)", fontSize: "0.875rem" },
  formFieldLabel: { fontWeight: 500, fontSize: "0.875rem" },
  formFieldInput: CAMPO,
  otpCodeFieldInput: { boxShadow: "none", borderColor: "var(--input)" },
  formButtonPrimary: BOTAO_PRIMARIO,
  socialButtonsBlockButton: { ...CAMPO, fontWeight: 500 },
  alternativeMethodsBlockButton: CAMPO,
  identityPreview: { justifyContent: "center" },
  // "Ainda não tem conta? Registar empresa" sits inside the card, then the
  // Clerk badge, small.
  // Clerk pads every footer child 16px 32px, which leaves the "Ainda não tem
  // conta?" line too narrow on phones and wraps it; zero it and centre.
  footer: {
    background: "none",
    padding: 0,
    marginTop: 0,
    gap: "0.5rem",
    "& > *": { padding: 0 },
  },
  footerAction: {
    "&&": { justifyContent: "center", gap: "0.25rem", padding: "0.5rem 0 0" },
  },
  footerActionText: {
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
    whiteSpace: "nowrap",
  },
  footerActionLink: {
    color: "var(--primary)",
    fontSize: "0.875rem",
    fontWeight: 500,
    whiteSpace: "nowrap",
    "&:hover": { color: "var(--primary)", textDecoration: "underline" },
  },
}

export const clerkAppearance: Appearance = {
  options: { logoPlacement: "none" },
  variables: {
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorForeground: "var(--foreground)",
    colorMutedForeground: "var(--muted-foreground)",
    colorMuted: "var(--muted)",
    colorNeutral: "var(--foreground)",
    colorBackground: "var(--background)",
    colorInput: "var(--background)",
    colorInputForeground: "var(--foreground)",
    colorBorder: "var(--border)",
    colorRing: "var(--ring)",
    colorDanger: "var(--destructive)",
    colorShadow: "transparent",
    borderRadius: "0.625rem",
    fontFamily: '"Inter Variable", sans-serif',
    fontFamilyButtons: '"Inter Variable", sans-serif',
    fontSize: "0.875rem",
  },
  elements: {
    cardBox: { boxShadow: "none", border: "1px solid var(--border)" },
    formButtonPrimary: BOTAO_PRIMARIO,
    formFieldInput: CAMPO,
  },
  signIn: { elements: EMBUTIDO },
  signUp: { elements: EMBUTIDO },
}

/**
 * pt-PT strings with the sign-in and sign-up openers reworded for Climaeco
 * Pro: Clerk's defaults name the Clerk application, which is not a customer-
 * facing name. Every other step keeps Clerk's translation.
 */
export const clerkLocalization: Localization = {
  ...ptPT,
  signIn: {
    ...ptPT.signIn,
    start: {
      ...ptPT.signIn?.start,
      title: "Entrar no Climaeco Pro",
      subtitle: "Bem-vindo de volta. Inicie sessão para continuar.",
      actionText: "Ainda não tem conta?",
      actionLink: "Registar empresa",
    },
  },
  signUp: {
    ...ptPT.signUp,
    start: {
      ...ptPT.signUp?.start,
      title: "Criar conta",
      subtitle: "Passo 1 de 2: a conta da pessoa de contacto.",
      actionText: "Já tem conta?",
      actionLink: "Entrar",
    },
  },
}
