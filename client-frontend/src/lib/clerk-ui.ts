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
  // Placeholder-only fields, Attio-style: the label stays for screen readers.
  formFieldLabel: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  formFieldLabelRow: { "&&": { marginBottom: 0 } },
  formFieldInput: CAMPO,
  otpCodeFieldInput: { boxShadow: "none", borderColor: "var(--input)" },
  formButtonPrimary: BOTAO_PRIMARIO,
  socialButtonsBlockButton: { ...CAMPO, fontWeight: 500 },
  alternativeMethodsBlockButton: CAMPO,
  identityPreview: { justifyContent: "center" },
  // No "Último uso" marker next to the method used last time.
  lastAuthenticationStrategyBadge: { display: "none" },
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

/** Outline `size="sm"` from `components/ui/button.tsx`, for Clerk's row actions. */
const BOTAO_CONTORNO = {
  minHeight: "2rem",
  padding: "0 0.75rem",
  borderRadius: "var(--radius-lg)",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--foreground)",
  backgroundColor: "var(--background)",
  boxShadow: "0 0 0 1px var(--input)",
  "&&:hover": { backgroundColor: "var(--muted)", color: "var(--foreground)" },
  "&&:focus-visible": { boxShadow: `0 0 0 1px var(--ring), ${ANEL}` },
}

/** `Badge variant="secondary"`: "Principal", "O utilizador", tab counts. */
const ETIQUETA = {
  backgroundColor: "var(--secondary)",
  color: "var(--secondary-foreground)",
  borderRadius: "9999px",
  padding: "0 0.5rem",
  fontSize: "0.75rem",
  fontWeight: 500,
  lineHeight: "1.25rem",
  boxShadow: "none",
  border: "none",
}

/**
 * The profile modals (Empresa › Gerir): the same shape as the page's cards.
 * Tinted side nav without Clerk's "Conta / Gira as informações…" header (the
 * page title already says it), hairline card, muted section labels on the
 * left, outline buttons for the row actions. Shared by `userProfile` and
 * `organizationProfile`.
 */
const MODAL: NonNullable<Appearance["elements"]> = {
  modalBackdrop: {
    backgroundColor: "color-mix(in oklch, var(--foreground), transparent 60%)",
  },
  cardBox: {
    width: "min(56rem, calc(100vw - 2rem))",
    height: "min(36rem, calc(100vh - 4rem))",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    boxShadow:
      "0 24px 48px -16px color-mix(in oklch, var(--foreground), transparent 70%)",
  },
  modalCloseButton: {
    color: "var(--muted-foreground)",
    borderRadius: "var(--radius-md)",
    "&&:hover": { color: "var(--foreground)", backgroundColor: "var(--muted)" },
  },
  navbar: {
    backgroundColor: "var(--sidebar)",
    borderRight: "1px solid var(--border)",
    // Clerk's navbar header (h1 + lead paragraph) carries no element key.
    "& h1": { display: "none" },
    "& h1 + p": { display: "none" },
  },
  navbarButtons: { gap: "0.125rem" },
  navbarButton: {
    minHeight: "2.25rem",
    padding: "0 0.625rem",
    borderRadius: "var(--radius-md)",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "var(--muted-foreground)",
    "&&:hover": {
      backgroundColor: "var(--sidebar-accent)",
      color: "var(--foreground)",
    },
    "&&.cl-active": {
      backgroundColor: "var(--sidebar-accent)",
      color: "var(--sidebar-accent-foreground)",
    },
  },
  navbarButtonIcon: { width: "1rem", height: "1rem", opacity: 1 },
  navbarMobileMenuRow: {
    backgroundColor: "var(--sidebar)",
    borderBottom: "1px solid var(--border)",
  },
  navbarMobileMenuButton: { fontSize: "1rem", fontWeight: 600 },
  // The 64px profile avatar drawn by `avatarComIniciais`.
  userPreviewAvatarBox: { "&&&": { fontSize: "1.375rem" } },
  headerTitle: {
    fontSize: "1rem",
    lineHeight: "1.5rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  pageScrollBox: {
    padding: "1.25rem 1.5rem 1.5rem",
    "@media (max-width: 40rem)": { padding: "0.5rem 1.25rem 1.25rem" },
  },
  profileSectionTitleText: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "var(--muted-foreground)",
  },
  profileSectionPrimaryButton: {
    ...BOTAO_CONTORNO,
    "@media (max-width: 40rem)": { padding: "0 0.5rem" },
    // "+ Adicionar um e-mail" stands alone under the list: a quiet text
    // action, not a full-width outlined bar.
    "&&.cl-profileSectionPrimaryButton__emailAddresses": {
      boxShadow: "none",
      backgroundColor: "transparent",
      color: "var(--muted-foreground)",
      justifyContent: "flex-start",
      padding: "0 0.25rem",
      width: "fit-content",
    },
    "&&.cl-profileSectionPrimaryButton__emailAddresses:hover": {
      color: "var(--foreground)",
      backgroundColor: "var(--muted)",
    },
  },
  badge: ETIQUETA,
  notificationBadge: ETIQUETA,
  menuButtonEllipsis: {
    color: "var(--muted-foreground)",
    borderRadius: "var(--radius-md)",
    "&&:hover": { color: "var(--foreground)", backgroundColor: "var(--muted)" },
  },
  // Organization › Membros
  tabButton: { fontSize: "0.875rem", fontWeight: 500 },
  membersPageInviteButton: { ...BOTAO_PRIMARIO, minHeight: "2.25rem" },
  searchInput: { ...CAMPO, minHeight: "2.25rem" },
  tableHead: { backgroundColor: "var(--muted)" },
  tableHeaderCell: {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "var(--muted-foreground)",
  },
  selectButton: { ...BOTAO_CONTORNO, minHeight: "2rem" },
  footerItem: { fontSize: "0.75rem" },
}

/**
 * `UserButton` menu (sidebar footer, phone top bar): a bordered popover the
 * size of our dropdowns, compact rows, muted icons. Clerk's default has no
 * edge (our `colorShadow` is transparent) and 16px×20px rows.
 */
const MENU_UTILIZADOR: NonNullable<Appearance["elements"]> = {
  userButtonPopoverCard: {
    "&&": {
      width: "16rem",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-xl)",
      boxShadow:
        "0 12px 32px -12px color-mix(in oklch, var(--foreground), transparent 75%)",
      backgroundColor: "var(--popover)",
    },
  },
  userPreview__userButton: { padding: "0.75rem 1rem", gap: "0.75rem" },
  userPreviewMainIdentifier: { fontSize: "0.875rem", fontWeight: 500 },
  userPreviewSecondaryIdentifier: {
    fontSize: "0.75rem",
    color: "var(--muted-foreground)",
  },
  userButtonPopoverActionButton: {
    padding: "0.625rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "var(--foreground)",
    "&&:hover": { backgroundColor: "var(--muted)", color: "var(--foreground)" },
  },
  userButtonPopoverActionButtonIconBox: {
    flex: "0 0 1.5rem",
    width: "1.5rem",
    color: "var(--muted-foreground)",
  },
  userButtonPopoverFooter: { padding: 0 },
  footerItem: { padding: "0.5rem 1rem", fontSize: "0.75rem" },
}

/**
 * Initials in place of Clerk's generated gradient avatar, for the components
 * Clerk renders itself (`UserButton`, `OrganizationSwitcher`, the profile
 * modal). Only for a user or organization with `hasImage === false`: the
 * `<img>` is hidden and the box draws the initials on the accent tint, like
 * `components/ui/avatar.tsx`. Callers spread the result into `elements`.
 */
export function avatarComIniciais(
  letras: string,
  forma: "circulo" | "quadrado" = "circulo"
): NonNullable<Appearance["elements"]> {
  const texto = letras.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase()
  return {
    avatarImage: { display: "none" },
    // Clerk's avatar rules sit on the class pair (`cl-avatarBox
    // cl-userButtonAvatarBox`), so the box needs `&&` to win. 11px suits the
    // 28–36px boxes (trigger, popover); the 64px profile-modal avatar bumps
    // it in `MODAL`.
    avatarBox: {
      "&&": {
        display: "grid",
        placeItems: "center",
        // Clerk's box keeps `justify-content: flex-start`, which packs the
        // single grid track (and the letters) to the left.
        placeContent: "center",
        // Not `--accent`: Clerk's buttons redefine it on themselves.
        backgroundColor: "var(--avatar)",
        color: "var(--avatar-foreground)",
        borderRadius: forma === "circulo" ? "9999px" : "var(--radius-md)",
        fontWeight: 600,
        fontSize: "0.6875rem",
        lineHeight: 1,
        letterSpacing: "0.025em",
        userSelect: "none",
      },
      "&::before": { content: `"${texto}"` },
    },
  }
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
    // Organization modal (Empresa › Membros › Gerir): no "Sair da
    // organização" / "Eliminar organização". The organization is the
    // company's link to Convex; leaving or deleting it is the office's call.
    profileSection__organizationDanger: { display: "none" },
  },
  signIn: { elements: EMBUTIDO },
  signUp: { elements: EMBUTIDO },
  userButton: { elements: MENU_UTILIZADOR },
  userProfile: { elements: MODAL },
  organizationProfile: { elements: MODAL },
}

/**
 * pt-PT strings with the openers cut to the bone (Attio-style: a title, a
 * field, a button): Clerk's defaults name the Clerk application and add a
 * welcome line. Placeholders double as labels. Every other step keeps
 * Clerk's translation.
 */
export const clerkLocalization: Localization = {
  ...ptPT,
  signIn: {
    ...ptPT.signIn,
    start: {
      ...ptPT.signIn?.start,
      title: "Bem-vindo",
      subtitle: "",
      actionText: "Ainda não tem conta?",
      actionLink: "Registar empresa",
    },
  },
  signUp: {
    ...ptPT.signUp,
    start: {
      ...ptPT.signUp?.start,
      title: "Criar conta",
      subtitle: "",
      actionText: "Já tem conta?",
      actionLink: "Entrar",
    },
  },
  formFieldInputPlaceholder__emailAddress: "Email",
  formFieldInputPlaceholder__emailAddress_username:
    "Email ou nome de utilizador",
  formFieldInputPlaceholder__username: "Nome de utilizador",
  formFieldInputPlaceholder__password: "Palavra-passe",
  formFieldInputPlaceholder__signUpPassword: "Palavra-passe",
}
