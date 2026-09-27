#!/usr/bin/env node
// Screenshot client-frontend pages at 390px and 1440px (the per-ticket
// verification in the "Climaeco Pro mobile-first front end" map) and report
// any horizontal overflow at 390px.
//
//   node scripts/dev/screenshots.mjs --port 3001 --out .context/shots /,/produtos
//   node scripts/dev/screenshots.mjs --port 3001 --signed-in /inicio,/empresa
//   node scripts/dev/screenshots.mjs --port 3001 --full-page /
//
// `--full-page` scrolls to the bottom first (so scroll-reveal sections have
// played) and captures the whole document instead of the first viewport.
//
// `--signed-in` signs a Clerk dev-instance test user in through the Backend API
// (needs CLERK_SECRET_KEY in the root .env): it creates
// `e2e+clerk_test@climaeco.pt` if missing, mints a sign-in token and redeems it
// in the browser with the `ticket` strategy, which sidesteps the Turnstile
// captcha on the sign-up form. The user has no password (tokens are the only
// way in) and no installer company, so the app shell shows the "Complete o
// registo" banner.
import { chromium } from "playwright"
import { mkdirSync, readFileSync } from "node:fs"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const port = flag("--port", process.env.CLIENT_PORT ?? "3001")
const out = flag("--out", ".context/shots")
const prefix = flag("--prefix", args.includes("--signed-in") ? "in" : "out")
const fullPage = args.includes("--full-page")
const FLAGS_WITH_VALUE = new Set(["--port", "--out", "--prefix"])
const positional = args.filter(
  (a, i) => !a.startsWith("--") && !FLAGS_WITH_VALUE.has(args[i - 1] ?? "")
)
const paths = (positional[0] ?? "/").split(",")
const base = `http://localhost:${port}`

mkdirSync(out, { recursive: true })

async function clerkTicket() {
  const env = readFileSync(new URL("../../.env", import.meta.url), "utf8")
  const key = /^CLERK_SECRET_KEY=(.+)$/m.exec(env)?.[1]?.trim().replace(/"/g, "")
  if (!key) throw new Error("CLERK_SECRET_KEY missing from .env")
  const api = async (path, init) => {
    const res = await fetch(`https://api.clerk.com/v1${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    })
    return res.json()
  }
  const email = "e2e+clerk_test@climaeco.pt"
  let [user] = await api(`/users?email_address=${encodeURIComponent(email)}`)
  user ??= await api("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      username: "e2e-shell",
      first_name: "E2E",
      last_name: "Shell",
    }),
  })
  const { token } = await api("/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
  })
  return token
}

const browser = await chromium.launch()
let storageState
if (args.includes("--signed-in")) {
  const ticket = await clerkTicket()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${base}/entrar`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.Clerk?.loaded, null, { timeout: 30000 })
  const status = await page.evaluate(async (t) => {
    const res = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: t })
    if (res.status === "complete") await window.Clerk.setActive({ session: res.createdSessionId })
    return res.status
  }, ticket)
  if (status !== "complete") throw new Error(`Clerk sign-in status: ${status}`)
  await page.waitForTimeout(1000)
  storageState = await ctx.storageState()
  await ctx.close()
}

const overflow = []
for (const [name, viewport] of [
  ["390", { width: 390, height: 844 }],
  ["1440", { width: 1440, height: 900 }],
]) {
  const ctx = await browser.newContext({ viewport, storageState })
  const page = await ctx.newPage()
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: "networkidle" })
    await page.waitForTimeout(600)
    if (fullPage) {
      // Step through the page so every IntersectionObserver-driven reveal
      // fires, then wait for the last transitions to settle.
      await page.evaluate(async () => {
        const passo = window.innerHeight / 2
        for (let y = 0; y < document.documentElement.scrollHeight; y += passo) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 200))
        }
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(1500)
    }
    const slug = path === "/" ? "landing" : path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")
    await page.screenshot({ path: `${out}/${prefix}-${slug}-${name}.png`, fullPage })
    const [scroll, client] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ])
    if (scroll > client) overflow.push(`${path} @${name}px: scrollWidth ${scroll} > ${client}`)
  }
  await ctx.close()
}
await browser.close()
console.log(overflow.length ? `OVERFLOW\n${overflow.join("\n")}` : "no horizontal overflow")
process.exitCode = overflow.length ? 1 : 0
