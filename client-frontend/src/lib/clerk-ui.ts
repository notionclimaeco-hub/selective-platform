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
  cardBox: {
    width: "100%",
    maxWidth: "none",
    boxShadow: "none",
    border: "none",
    borderRadius: 0,
  },
  card: { padding: 0, boxShadow: "none", border: "none", gap: "1.5rem" },
  headerTitle: {
    fontSize: "1.25rem",
    fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  headerSubtitle: { color: "var(--muted-foreground)" },
  footer: {
    background: "none",
    padding: 0,
    marginTop: "0.25rem",
  },
  // The page renders its own "Ainda não tem conta?" line under the card.
  footerAction: { display: "none" },
  formFieldInput: CAMPO,
  otpCodeFieldInput: { boxShadow: "none", borderColor: "var(--input)" },
  formButtonPrimary: BOTAO_PRIMARIO,
  socialButtonsBlockButton: { ...CAMPO, fontWeight: 500 },
  alternativeMethodsBlockButton: CAMPO,
  identityPreview: { justifyContent: "center" },
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
      title: "Entrar",
      subtitle: "Aceda à área da sua empresa instaladora.",
    },
  },
  signUp: {
    ...ptPT.signUp,
    start: {
      ...ptPT.signUp?.start,
      title: "Criar conta",
      subtitle: "A conta da pessoa de contacto. A empresa vem a seguir.",
    },
  },
}
