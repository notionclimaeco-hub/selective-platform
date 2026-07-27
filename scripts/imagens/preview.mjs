// Brand image preview: always generate rembg cutouts, then pick cutout vs original.
//
// Usage:
//   node scripts/imagens/preview.mjs --brand hisense
//   node scripts/imagens/preview.mjs --brand hisense --serve
//   node scripts/imagens/preview.mjs --brand hisense --rembg-all
//
// Writes product-scaffold/preview-<marca>.html
// With --serve: http://127.0.0.1:3847
//   1) Rembg runs for every matched image (cached)
//   2) You pick Original / Cutout per image
//   3) “Guardar escolha” → product-scaffold/image-choice.json
//
// Then tell the agent to process+upload using that file, or run:
//   pnpm imagens:process -- --brand hisense --choice-from product-scaffold/image-choice.json
//   pnpm imagens:upload -- --brand hisense

import { createServer } from "node:http"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync, createReadStream, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  cutoutPathForSource,
  ensureCutouts,
  resolveRepoPath,
  toRepoRelative,
} from "./lib/rembg.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const MAPPING = path.join(ROOT, "product-scaffold/mapping.json")
const CHOICE = path.join(ROOT, "product-scaffold/image-choice.json")
const PORT = 3847

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".webp") return "image/webp"
  if (ext === ".html") return "text/html; charset=utf-8"
  if (ext === ".json") return "application/json"
  return "application/octet-stream"
}

/** @returns {Promise<Record<string, "cutout" | "original" | "exclude">>} */
async function loadChoices(brand) {
  if (!existsSync(CHOICE)) return {}
  try {
    const data = JSON.parse(await readFile(CHOICE, "utf8"))
    if (data.brand && brand && data.brand !== brand) return {}
    if (data.choices && typeof data.choices === "object") return data.choices
    const out = {}
    for (const item of data.items ?? []) {
      if (
        item.file &&
        (item.use === "cutout" || item.use === "original" || item.use === "exclude")
      ) {
        out[item.file] = item.use
      }
    }
    return out
  } catch {
    return {}
  }
}

async function listBrandSources(brand) {
  if (!existsSync(MAPPING)) {
    throw new Error("Falta product-scaffold/mapping.json — corre match primeiro.")
  }
  const mapping = JSON.parse(await readFile(MAPPING, "utf8"))
  const sources = []
  for (const m of mapping) {
    if (brand && m.marca !== brand) continue
    for (const f of m.files ?? []) {
      const abs = resolveRepoPath(f)
      if (existsSync(abs)) sources.push(abs)
    }
  }
  return [...new Set(sources)]
}

async function rembgAll(brand) {
  const sources = await listBrandSources(brand)
  if (sources.length === 0) {
    throw new Error(`Sem imagens matched para marca=${brand}`)
  }
  console.log(`Rembg em todas as ${sources.length} imagens (${brand})…`)
  await ensureCutouts(sources)
  return sources.length
}

async function buildEntries(brand) {
  const mapping = JSON.parse(await readFile(MAPPING, "utf8"))
  const choices = await loadChoices(brand)
  const entries = []

  for (const m of mapping) {
    if (brand && m.marca !== brand) continue
    if (!m.files?.length && !m.manual) continue
    const images = []
    for (let index = 0; index < (m.files ?? []).length; index++) {
      const f = m.files[index]
      const abs = resolveRepoPath(f)
      if (!existsSync(abs)) continue
      const rel = toRepoRelative(abs)
      const { cached, exists } = await cutoutPathForSource(abs)
      const saved = choices[rel]
      const use =
        saved === "original" || saved === "cutout" || saved === "exclude"
          ? saved
          : exists
            ? "cutout"
            : "original"
      images.push({
        file: rel,
        index,
        originalUrl: rel,
        cutoutUrl: exists ? toRepoRelative(cached) : null,
        use,
      })
    }
    if (images.length === 0) continue
    entries.push({
      slug: m.slug,
      nome: m.nome,
      marca: m.marca,
      unitSide: m.unitSide ?? null,
      pageSlug: m.pageSlug ?? null,
      images,
    })
  }
  return entries
}

function assetUrl(repoRel, serveMode) {
  if (!repoRel) return ""
  const norm = repoRel.replace(/\\/g, "/")
  if (serveMode) return "/" + norm
  if (norm.startsWith("product-scaffold/")) {
    return norm.slice("product-scaffold/".length)
  }
  return "../" + norm
}

function renderHtml(brand, entries, { serveMode }) {
  const rows = entries
    .map((e) => {
      const cells = e.images
        .map((img) => {
          const originalUrl = assetUrl(img.originalUrl, serveMode)
          const cutoutUrl = img.cutoutUrl
            ? assetUrl(img.cutoutUrl, serveMode)
            : null
          const showUrl = img.use === "cutout" && cutoutUrl ? cutoutUrl : originalUrl
          const cutoutDisabled = cutoutUrl ? "" : " disabled"
          const frameClass = [
            "frame",
            img.use === "cutout" ? "show-cutout" : "",
            img.use === "exclude" ? "excluded" : "",
          ]
            .filter(Boolean)
            .join(" ")
          return `<figure class="shot${img.use === "exclude" ? " is-excluded" : ""}" data-file="${escapeHtml(img.file)}" data-slug="${escapeHtml(e.slug)}" data-index="${img.index}">
  <div class="${frameClass}">
    <img class="preview-img" src="${escapeHtml(showUrl)}"
      data-original="${escapeHtml(originalUrl)}"
      ${cutoutUrl ? `data-cutout="${escapeHtml(cutoutUrl)}"` : ""}
      loading="lazy" alt="" />
  </div>
  <div class="pick" role="radiogroup" aria-label="Versão">
    <label><input type="radio" name="use-${escapeHtml(img.file)}" value="original"${img.use === "original" ? " checked" : ""} /> Original</label>
    <label><input type="radio" name="use-${escapeHtml(img.file)}" value="cutout"${img.use === "cutout" ? " checked" : ""}${cutoutDisabled} /> Cutout</label>
    <label class="exclude"><input type="radio" name="use-${escapeHtml(img.file)}" value="exclude"${img.use === "exclude" ? " checked" : ""} /> Excluir</label>
  </div>
  <figcaption>
    <code>${escapeHtml(e.slug)} #${img.index + 1}</code>
    <span class="badge${img.use === "exclude" ? " excl" : cutoutUrl ? " ok" : ""}">${img.use === "exclude" ? "excluída" : cutoutUrl ? "rembg ok" : "sem cutout"}</span>
  </figcaption>
</figure>`
        })
        .join("\n")
      return `<tr class="group-row" data-slug="${escapeHtml(e.slug)}">
  <td class="meta">
    <strong>${escapeHtml(e.nome)}</strong><br/>
    <code>${escapeHtml(e.slug)}</code><br/>
    <small>${escapeHtml(e.unitSide || "—")}${e.pageSlug ? " · " + escapeHtml(e.pageSlug) : ""}</small>
    <div class="group-actions">
      <button type="button" class="btn-group-use" data-slug="${escapeHtml(e.slug)}" data-use="original" title="Marcar todas as imagens deste grupo como Original">Tudo original</button>
      <button type="button" class="btn-group-use" data-slug="${escapeHtml(e.slug)}" data-use="cutout" title="Marcar todas as imagens deste grupo como Cutout">Tudo cutout</button>
      <button type="button" class="btn-group-use btn-exclude-group" data-slug="${escapeHtml(e.slug)}" data-use="exclude" title="Marcar todas as imagens deste grupo como Excluir">Excluir todas</button>
    </div>
  </td>
  <td class="gallery">${cells}</td>
</tr>`
    })
    .join("\n")

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Preview ${escapeHtml(brand || "catálogo")} — original vs cutout</title>
  <style>
    :root {
      --bg: #eef3f0; --ink: #14201a; --muted: #4a5c52; --line: #d5e0d8;
      --card: #fff; --accent: #1f6b4a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      background: var(--bg); color: var(--ink);
    }
    header {
      position: sticky; top: 0; z-index: 10;
      background: rgba(238,243,240,.94); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--line); padding: 1rem 1.5rem;
    }
    header h1 { margin: 0 0 .35rem; font-size: 1.35rem; font-weight: 600; }
    header .row { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; }
    .hint { margin: .55rem 0 0; color: var(--muted); font-size: .92rem; max-width: 76ch; }
    button {
      font: inherit; font-size: .88rem; cursor: pointer;
      border: 1px solid #9bb5a6; background: #fff; color: var(--ink);
      border-radius: 8px; padding: .45rem .8rem;
    }
    button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .group-actions { margin-top: .65rem; display: flex; flex-wrap: wrap; gap: .35rem; }
    .btn-group-use { font-size: .78rem; padding: .3rem .55rem; }
    .btn-exclude-group {
      border-color: #d4a0a0; color: #8a3b3b; background: #fff7f7;
    }
    .btn-exclude-group:hover { background: #f3e0e0; }
    #status { color: var(--muted); font-size: .9rem; }
    main { padding: 1rem 1.5rem 3rem; }
    table { width: 100%; border-collapse: collapse; background: var(--card); }
    td { padding: 1rem; border-bottom: 1px solid var(--line); vertical-align: top; }
    td.meta { width: 260px; }
    code { font-size: .78rem; }
    .gallery { display: flex; flex-wrap: wrap; gap: .75rem; }
    .shot { margin: 0; width: 180px; display: flex; flex-direction: column; gap: .35rem; }
    .pick {
      display: flex; flex-wrap: wrap; gap: .55rem .7rem; font-size: .8rem; color: var(--muted);
    }
    .pick label { display: flex; align-items: center; gap: .3rem; cursor: pointer; }
    .pick label.exclude { color: #8a3b3b; }
    .frame {
      width: 180px; height: 180px; border: 1px solid var(--line); border-radius: 12px;
      overflow: hidden; background-color: #f7faf8;
      background-image:
        linear-gradient(45deg, #dce5df 25%, transparent 25%),
        linear-gradient(-45deg, #dce5df 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #dce5df 75%),
        linear-gradient(-45deg, transparent 75%, #dce5df 75%);
      background-size: 14px 14px;
      background-position: 0 0, 0 7px, 7px -7px, -7px 0;
      position: relative;
    }
    .frame.show-cutout { outline: 2px solid var(--accent); outline-offset: 1px; }
    .frame.excluded { outline: 2px solid #b85c5c; outline-offset: 1px; opacity: .45; }
    .frame.excluded::after {
      content: "excluída"; position: absolute; inset: auto 8px 8px auto;
      background: #8a3b3b; color: #fff; font-size: .68rem; letter-spacing: .04em;
      text-transform: uppercase; border-radius: 999px; padding: .15rem .45rem;
    }
    .shot.is-excluded figcaption code { text-decoration: line-through; color: var(--muted); }
    .preview-img { width: 100%; height: 100%; object-fit: contain; display: block; }
    figcaption { display: flex; justify-content: space-between; align-items: center; gap: .25rem; }
    .badge {
      font-size: .68rem; text-transform: uppercase; letter-spacing: .04em;
      color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: .1rem .4rem;
      white-space: nowrap;
    }
    .badge.ok { color: var(--accent); border-color: #9cc7b0; }
    .badge.excl { color: #8a3b3b; border-color: #e0b0b0; }
  </style>
</head>
<body>
  <header>
    <h1>Preview ${escapeHtml(brand || "catálogo")} — original / cutout / excluir</h1>
    <div class="row">
      <button type="button" id="btn-all-cutout">Tudo cutout</button>
      <button type="button" id="btn-all-original">Tudo original</button>
      <button type="button" id="btn-rembg"${serveMode ? "" : " disabled"}>Atualizar rembg</button>
      <button type="button" id="btn-save" class="primary">Guardar escolha</button>
      <span id="status">Escolhe Original, Cutout ou Excluir por imagem</span>
    </div>
    <p class="hint">
      O rembg corre em <em>todas</em> as imagens. Tu decides qual versão sobe — ou <strong>Excluir</strong>
      para não processar/upload dessa foto. Depois de <strong>Guardar escolha</strong>, diz ao agente
      para processar e fazer upload com <code>product-scaffold/image-choice.json</code>.
    </p>
  </header>
  <main>
    <table><tbody>
${rows}
    </tbody></table>
  </main>
  <script>
    const SERVE = ${serveMode ? "true" : "false"};
    const BRAND = ${JSON.stringify(brand || "")};
    const statusEl = document.getElementById("status");

    function shots() { return [...document.querySelectorAll(".shot")]; }

    function applyShot(shot) {
      const use = shot.querySelector('input[type=radio]:checked')?.value || "original";
      const img = shot.querySelector(".preview-img");
      const frame = shot.querySelector(".frame");
      const badge = shot.querySelector(".badge");
      if (!img) return;
      shot.classList.toggle("is-excluded", use === "exclude");
      frame?.classList.toggle("excluded", use === "exclude");
      frame?.classList.toggle("show-cutout", use === "cutout" && !!img.dataset.cutout);
      if (use === "cutout" && img.dataset.cutout) {
        img.src = img.dataset.cutout;
      } else {
        img.src = img.dataset.original;
      }
      if (badge) {
        if (use === "exclude") {
          badge.textContent = "excluída";
          badge.classList.add("excl");
          badge.classList.remove("ok");
        } else if (img.dataset.cutout) {
          badge.textContent = "rembg ok";
          badge.classList.add("ok");
          badge.classList.remove("excl");
        } else {
          badge.textContent = "sem cutout";
          badge.classList.remove("ok", "excl");
        }
      }
    }

    function payload() {
      const items = shots().map((shot) => {
        const use = shot.querySelector('input[type=radio]:checked')?.value || "original";
        return {
          slug: shot.dataset.slug,
          index: Number(shot.dataset.index),
          file: shot.dataset.file,
          use,
        };
      });
      const choices = {};
      for (const item of items) choices[item.file] = item.use;
      return {
        brand: BRAND || null,
        updatedAt: new Date().toISOString(),
        choices,
        items,
      };
    }

    function setAll(use) {
      for (const shot of shots()) {
        const radio = shot.querySelector('input[type=radio][value="' + use + '"]');
        if (radio && !radio.disabled) {
          radio.checked = true;
          applyShot(shot);
        }
      }
    }

    function setGroup(slug, use) {
      let n = 0;
      for (const shot of shots()) {
        if (shot.dataset.slug !== slug) continue;
        const radio = shot.querySelector('input[type=radio][value="' + use + '"]');
        if (radio && !radio.disabled) {
          radio.checked = true;
          applyShot(shot);
          n++;
        }
      }
      return n;
    }

    shots().forEach((shot) => {
      shot.querySelectorAll('input[type=radio]').forEach((r) => {
        r.addEventListener("change", () => applyShot(shot));
      });
    });

    const useLabel = { original: "Original", cutout: "Cutout", exclude: "Excluir" };
    document.querySelectorAll(".btn-group-use").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.dataset.slug;
        const use = btn.dataset.use;
        const n = setGroup(slug, use);
        statusEl.textContent = "Grupo " + slug + ": " + n + " imagem(ns) → " + (useLabel[use] || use) + " — Guardar escolha para persistir";
      });
    });

    document.getElementById("btn-all-cutout").onclick = () => setAll("cutout");
    document.getElementById("btn-all-original").onclick = () => setAll("original");

    document.getElementById("btn-save").onclick = async () => {
      const body = payload();
      try {
        if (SERVE) {
          const res = await fetch("/api/choice", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(await res.text());
          const excluded = body.items.filter((i) => i.use === "exclude").length;
          statusEl.textContent = "Guardado em product-scaffold/image-choice.json (" +
            body.items.length + " imagens" + (excluded ? ", " + excluded + " excluídas" : "") + ")";
        } else {
          const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "image-choice.json";
          a.click();
          URL.revokeObjectURL(a.href);
          statusEl.textContent = "Descarregado — move para product-scaffold/image-choice.json";
        }
      } catch (err) {
        alert(err.message || err);
      }
    };

    document.getElementById("btn-rembg").onclick = async () => {
      if (!SERVE) return;
      statusEl.textContent = "A correr rembg em todas…";
      try {
        const res = await fetch("/api/rembg-all", { method: "POST" });
        if (!res.ok) throw new Error(await res.text());
        statusEl.textContent = "Rembg concluído — a recarregar…";
        location.reload();
      } catch (err) {
        alert(err.message || err);
      }
    };
  </script>
</body>
</html>`
}

async function writePreviewFile(brand, entries, opts) {
  const out = path.join(
    ROOT,
    "product-scaffold",
    `preview-${brand || "all"}.html`,
  )
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, renderHtml(brand, entries, opts))
  return out
}

async function saveChoice(body, brand) {
  const payload = {
    brand: body.brand || brand,
    updatedAt: new Date().toISOString(),
    choices: body.choices ?? {},
    items: body.items ?? [],
  }
  await mkdir(path.dirname(CHOICE), { recursive: true })
  await writeFile(CHOICE, JSON.stringify(payload, null, 2) + "\n")
  return payload
}

function startServer(brand) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`)

      if (req.method === "PUT" && url.pathname === "/api/choice") {
        const chunks = []
        for await (const c of req) chunks.push(c)
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        const payload = await saveChoice(body, brand)
        res.writeHead(200, { "content-type": "application/json" })
        res.end(JSON.stringify({ ok: true, count: payload.items.length }))
        return
      }

      if (req.method === "POST" && url.pathname === "/api/rembg-all") {
        await rembgAll(brand)
        const entries = await buildEntries(brand)
        await writePreviewFile(brand, entries, { serveMode: true })
        res.writeHead(200, { "content-type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        const entries = await buildEntries(brand)
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
        res.end(renderHtml(brand, entries, { serveMode: true }))
        return
      }

      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "")
      const abs = path.join(ROOT, rel)
      const rootResolved = path.resolve(ROOT)
      if (!abs.startsWith(rootResolved) || !existsSync(abs) || statSync(abs).isDirectory()) {
        res.writeHead(404)
        res.end("Not found")
        return
      }
      res.writeHead(200, { "content-type": mimeFor(abs) })
      createReadStream(abs).pipe(res)
    } catch (err) {
      console.error(err)
      res.writeHead(500, { "content-type": "text/plain" })
      res.end(err instanceof Error ? err.message : String(err))
    }
  })

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Preview: http://127.0.0.1:${PORT}/`)
    console.log("Escolhe Original/Cutout/Excluir → Guardar escolha. Ctrl+C para parar.")
  })
}

async function main() {
  const brand = arg("brand")
  if (!brand) {
    console.error("Indica --brand <marca> (ex: hisense)")
    process.exit(1)
  }

  const shouldRembg =
    hasFlag("rembg-all") || hasFlag("serve") || hasFlag("apply-rembg")

  if (shouldRembg) {
    await rembgAll(brand)
  }

  const entries = await buildEntries(brand)
  if (entries.length === 0) {
    console.error(`Sem imagens matched para marca=${brand}`)
    process.exit(1)
  }

  if (hasFlag("serve")) {
    const out = await writePreviewFile(brand, entries, { serveMode: true })
    console.log(`Wrote ${path.relative(ROOT, out)}`)
    startServer(brand)
    return
  }

  const out = await writePreviewFile(brand, entries, { serveMode: false })
  console.log(`Wrote ${path.relative(ROOT, out)} (${entries.length} produtos)`)
  if (!shouldRembg) {
    console.log(`Para gerar cutouts: pnpm imagens:preview -- --brand ${brand} --rembg-all`)
  }
  console.log(`Ou com UI: pnpm imagens:preview -- --brand ${brand} --serve`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
