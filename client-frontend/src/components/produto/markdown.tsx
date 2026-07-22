import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Renders product descriptions (paragraphs + GFM spec tables) with styling that
// matches the brand aesthetic. Kept intentionally small: only the elements that
// actually appear in our descriptions are styled.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-muted-foreground">
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
              className="font-medium text-primary underline underline-offset-4"
            >
              {children}
            </a>
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
