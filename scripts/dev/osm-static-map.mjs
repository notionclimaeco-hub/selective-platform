#!/usr/bin/env node
// Build the static warehouse map shown on the landing page from OpenStreetMap
// tiles (ODbL; the page credits "© OpenStreetMap contributors"). One-off,
// so the site never hits the tile servers at runtime.
//
//   node scripts/dev/osm-static-map.mjs
//
// Output: client-frontend/public/mapa-armazem.jpg (2048×768, zoom 17).
import sharp from "sharp"
import { writeFileSync } from "node:fs"

const LAT = 38.7628603
const LON = -9.2814335
const ZOOM = 17
const WIDTH = 2048
const HEIGHT = 768
const TILE = 256
const OUT = new URL("../../client-frontend/public/mapa-armazem.jpg", import.meta.url)

// Web Mercator pixel coordinates of the pin at this zoom.
const n = 2 ** ZOOM
const px = ((LON + 180) / 360) * n * TILE
const latRad = (LAT * Math.PI) / 180
const py = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE

const left = Math.round(px - WIDTH / 2)
const top = Math.round(py - HEIGHT / 2)
const x0 = Math.floor(left / TILE)
const y0 = Math.floor(top / TILE)
const x1 = Math.floor((left + WIDTH - 1) / TILE)
const y1 = Math.floor((top + HEIGHT - 1) / TILE)

const composites = []
for (let x = x0; x <= x1; x++) {
  for (let y = y0; y <= y1; y++) {
    const url = `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`
    const res = await fetch(url, {
      headers: { "User-Agent": "climaeco-landing-static-map/1.0 (one-off build script)" },
    })
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    composites.push({
      input: Buffer.from(await res.arrayBuffer()),
      left: x * TILE - left,
      top: y * TILE - top,
    })
    await new Promise((r) => setTimeout(r, 150))
  }
}

const canvas = sharp({
  create: { width: (x1 - x0 + 1) * TILE, height: (y1 - y0 + 1) * TILE, channels: 3, background: "#fff" },
})
const stitched = await canvas
  .composite(composites.map((c) => ({ ...c, left: c.left + (left - x0 * TILE), top: c.top + (top - y0 * TILE) })))
  .png()
  .toBuffer()
const out = await sharp(stitched)
  .extract({ left: left - x0 * TILE, top: top - y0 * TILE, width: WIDTH, height: HEIGHT })
  .jpeg({ quality: 78, mozjpeg: true })
  .toBuffer()
writeFileSync(OUT, out)
console.log(`wrote ${OUT.pathname} (${Math.round(out.length / 1024)} KB, ${composites.length} tiles)`)
