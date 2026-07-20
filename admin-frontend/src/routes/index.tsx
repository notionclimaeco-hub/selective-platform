import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { api } from "@convex/_generated/api"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  const { data } = useSuspenseQuery(convexQuery(api.tasks.get, {}))

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Selective — Admin</h1>
          <p>Tasks loaded live from the shared Convex backend:</p>
        </div>
        <ul className="flex flex-col gap-1">
          {data.map(({ _id, text, isCompleted }) => (
            <li
              key={_id}
              className={isCompleted ? "line-through opacity-60" : ""}
            >
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
