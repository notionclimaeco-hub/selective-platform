import { Toaster as Sonner } from "sonner"
import type { ToasterProps } from "sonner"

/**
 * One toaster for the app, on the design tokens: popover surface, hairline
 * border, primary "Reverter"-style action. Mounted once in `__root.tsx`;
 * call `toast()` from `sonner` anywhere.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      duration={6000}
      // Clears the import review page's fixed decision bar (`__root.tsx`
      // mounts it with the same offset).
      offset={{ bottom: 80 }}
      mobileOffset={{ bottom: 80 }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
          "--width": "22rem",
          fontFamily: "var(--font-sans)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "text-sm! shadow-lg! ring-1! ring-foreground/5! border!",
          title: "font-medium!",
          actionButton:
            "bg-primary! text-primary-foreground! rounded-md! text-xs! font-medium! h-7! px-2.5!",
        },
      }}
      {...props}
    />
  )
}
