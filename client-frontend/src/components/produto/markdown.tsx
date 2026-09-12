import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Renders product descriptions (paragraphs + GFM spec tables) with styling that
// matches the brand aesthetic. Kept intentionally small: only the elements that
// actually appear in our descriptions are styled.
export function Markdown({ children }: { children: string }) {
  return (
    // `break-words` keeps long unbroken tokens (URLs, refs) from widening the
    // page on phones; `min-w-0` lets the column shrink inside its grid cell.
    <div className="min-w-0 text-sm leading-relaxed break-words text-muted-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-1 pl-5 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-1 pl-5 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium break-all text-primary underline underline-offset-4"
            >
              {children}
            </a>
          ),
          // Code, pre and images can't wrap on their own: contain them so a
          // wide snippet or picture scrolls inside its box, never the page.
          pre: ({ children }) => (
            <pre className="mb-4 max-w-full overflow-x-auto rounded-lg bg-muted p-3 text-xs last:mb-0">
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] break-all">
              {children}
            </code>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt ?? ""}
              loading="lazy"
              className="my-4 h-auto max-w-full rounded-lg"
            />
          ),
          h1: ({ children }) => (
            <h3 className="mb-3 text-base font-semibold text-foreground">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-3 text-base font-semibold text-foreground">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-2 font-semibold text-foreground">{children}</h4>
          ),
          // Spec tables embedded in descriptions duplicate the variant
          // selector, so they're not rendered at all.
          table: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
