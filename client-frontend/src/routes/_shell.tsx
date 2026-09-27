import { createFileRoute, Outlet } from "@tanstack/react-router"

import { ShellByAuth } from "@/components/shell/shell-by-auth"

/** Pathless layout: every public and environment page gets its chrome here. */
export const Route = createFileRoute("/_shell")({
  component: () => (
    <ShellByAuth>
      <Outlet />
    </ShellByAuth>
  ),
})
