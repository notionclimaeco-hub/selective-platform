import { createFileRoute, Outlet } from "@tanstack/react-router"

import { MinimalShell } from "@/components/shell/minimal-shell"

/** Pathless layout for the focused pages: Entrar, Registo, payment link. */
export const Route = createFileRoute("/_minimal")({
  component: () => (
    <MinimalShell>
      <Outlet />
    </MinimalShell>
  ),
})
