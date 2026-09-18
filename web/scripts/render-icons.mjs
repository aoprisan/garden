// Regenerates public/*.png from the same marigold artwork as favicon.svg, so
// every icon is one drawing at several sizes rather than four files drifting
// apart. The PNGs are committed — this only needs re-running when the artwork
// changes.
//
//   npm i -D playwright && node scripts/render-icons.mjs
//
// Playwright is NOT a dependency of this project (it would pull a browser into
// every install for a once-a-year job); install it ad hoc, or hand the SVG below
// to any other rasterizer.
import { chromium } from 'playwright'

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/** The plant, drawn in a 64×64 box. `scale` shrinks it toward the centre so a
 *  maskable icon keeps its subject inside Android's safe circle. */
const artwork = (scale = 1) => `
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <ellipse cx="32" cy="52" rx="16" ry="4" fill="#4b3a2a"/>
    <path d="M32 52 Q30 36 32 22" stroke="#5f8f43" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M31 40 Q22 38 20 31 Q29 30 31 40Z" fill="#5f8f43"/>
    <path d="M33 33 Q42 31 44 24 Q35 23 33 33Z" fill="#6ea04d"/>
    <g fill="#f0a33c">
      <ellipse cx="32" cy="14" rx="5" ry="3"/>
      <ellipse cx="32" cy="24" rx="5" ry="3"/>
      <ellipse cx="27" cy="19" rx="3" ry="5"/>
      <ellipse cx="37" cy="19" rx="3" ry="5"/>
    </g>
    <circle cx="32" cy="19" r="3.4" fill="#8a4b1e"/>
  </g>`

// Full-bleed background: iOS and Android round the corners themselves, and a
// transparent icon shows up as a black square on an iPhone home screen.
const icon = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1a1410"/>
  <rect width="64" height="64" fill="url(#g)"/>
  <defs><radialGradient id="g" cx="0.5" cy="0.15" r="0.9">
    <stop offset="0" stop-color="#3a2e22"/><stop offset="1" stop-color="#1a1410" stop-opacity="0"/>
  </radialGradient></defs>
  ${artwork(scale)}
</svg>`

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const files = [
  ['icon-192.png', 192, 0.92],
  ['icon-512.png', 512, 0.92],
  ['icon-maskable-512.png', 512, 0.68], // subject inside the 80% safe circle
  ['apple-touch-icon.png', 180, 0.92],
]
for (const [name, size, scale] of files) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(`<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${icon(scale)}`)
  await page.screenshot({ path: `${OUT}/${name}`, omitBackground: false })
  await page.close()
  console.log('wrote', name, size)
}
await browser.close()
