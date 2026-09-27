import { useRouteContext } from "@tanstack/react-router"

import { AppShell } from "./app-shell"
import { MarketingShell } from "./marketing-shell"

/**
 * One route tree, two chromes. The root route resolves the Clerk session on
 * every navigation (server function in `beforeLoad`), so the decision is the
 * same on the server and the client and never flickers on hydration.
 */
export function ShellByAuth({ children }: { children: React.ReactNode }) {
  const { userId } = useRouteContext({ from: "__root__" })
  return userId ? (
    <AppShell>{children}</AppShell>
  ) : (
    <MarketingShell>{children}</MarketingShell>
  )
}
