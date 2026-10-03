// PROTOTYPE (#86) — throwaway. Admin app orders board on fixture data (no
// backend): one lane per stage; a card opens the order page.

import { createFileRoute } from "@tanstack/react-router"

import { Quadro } from "@/components/prototype-encomendas/quadro"

export const Route = createFileRoute("/prototype/encomendas")({
  // Fixture timestamps come from Date.now() at module load; render on the
  // client only so server and client never disagree.
  ssr: false,
  component: Quadro,
})
