import { useEffect, useState } from "react"

// Debounce free-text search so each keystroke doesn't re-run a paginated
// query (dropdown filters apply immediately).
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
