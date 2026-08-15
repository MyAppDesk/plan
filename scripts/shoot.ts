/**
 * Real screenshots of the running app, for the README.
 *
 * Builds nothing itself: point it at a production build (`npm run build`), it
 * serves `dist/`, drives the actual UI in Chromium — clicking the same panels
 * and pressing the same keys you would — and writes WebP stills and clips.
 *
 *   npm run docs:shoot
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { chromium, type Page } from 'playwright'
import { balconyFlat } from '../src/lib/templates'

const DIST = join(process.cwd(), 'dist')
const OUT = join(process.cwd(), 'docs')
const PORT = 4178
const SIZE = { width: 1500, height: 940 }

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
}

/** Serves the built app, so the shots are of the real thing, not the dev server. */
function serve() {
  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0]
    let path = join(DIST, normalize(url === '/' ? '/index.html' : url))
    if (!path.startsWith(DIST) || !existsSync(path) || statSync(path).isDirectory()) path = join(DIST, 'index.html')
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' })
    createReadStream(path).pipe(res)
  })
  return new Promise<() => void>((resolve) => {
    server.listen(PORT, () => resolve(() => server.close()))
  })
}

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] })

function toWebp(png: string, name: string, quality = 86) {
  run('cwebp', ['-quiet', '-q', String(quality), png, '-o', join(OUT, `${name}.webp`)])
}

/**
 * A short clip: Chromium records the whole session as webm, ffmpeg cuts the
 * interesting seconds out of it and turns those into an animated WebP small
 * enough to sit in a README.
 */
function clipToWebp(
  webm: string,
  name: string,
  { start = 0, seconds = 5, fps = 10, width = 900, quality = 35 } = {},
) {
  run('ffmpeg', [
    '-y',
    '-loglevel', 'error',
    '-ss', String(start),
    '-t', String(seconds),
    '-i', webm,
    '-vf', `fps=${fps},scale=${width}:-2:flags=lanczos`,
    '-vcodec', 'libwebp',
    '-lossless', '0',
    '-q:v', String(quality),
    '-compression_level', '6',
    '-loop', '0',
    '-preset', 'picture',
    '-an',
    join(OUT, `${name}.webp`),
  ])
}

const wait = (page: Page, ms: number) => page.waitForTimeout(ms)

/** Drops the sample flat straight into the library, so the app opens on it. */
function seed() {
  const project = balconyFlat()
  const id = 'prjdemo'
  return {
    index: {
      entries: [{ id, name: project.name, updatedAt: 1, floors: project.floors.length }],
      currentId: id,
      seenLanding: true,
      cookiesAck: true,
    },
    id,
    project,
  }
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('no dist/ — run `npm run build` first')
  mkdirSync(OUT, { recursive: true })
  const work = mkdtempSync(join(tmpdir(), 'measure-shots-'))
  // the raw clips are kept, so the encoding can be retuned without driving the
  // browser again
  const keep = join(process.cwd(), 'node_modules', '.cache', 'shots')
  mkdirSync(keep, { recursive: true })
  const stop = await serve()
  const browser = await chromium.launch()
  const { index, id, project } = seed()

  const open = async (record = false) => {
    const context = await browser.newContext({
      viewport: SIZE,
      deviceScaleFactor: 2,
      colorScheme: 'dark',
      recordVideo: record ? { dir: work, size: SIZE } : undefined,
    })
    await context.addInitScript(
      ([indexJson, key, projectJson]) => {
        localStorage.setItem('measure.library.v1', indexJson)
        localStorage.setItem(key, projectJson)
      },
      [JSON.stringify(index), `measure.project.${id}`, JSON.stringify(project)] as const,
    )
    const page = await context.newPage()
    await page.goto(`http://localhost:${PORT}/`)
    await page.waitForSelector('canvas')
    await wait(page, 900)
    return { context, page }
  }

  const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()

  /** Panels remember where they were scrolled to; every shot starts at the top. */
  const rewind = (page: Page) =>
    page.evaluate(() => {
      document.querySelectorAll('aside .overflow-y-auto').forEach((el) => ((el as HTMLElement).scrollTop = 0))
    })

  const shot = async (page: Page, name: string) => {
    await rewind(page)
    await wait(page, 250)
    await page.screenshot({ path: join(work, `${name}.png`) })
    toWebp(join(work, `${name}.png`), name)
  }

  /* 1. the plan as it opens ------------------------------------------------- */
  {
    const { context, page } = await open()
    await page.keyboard.press('f')
    await wait(page, 600)
    await shot(page, 'ui-plan')

    /* 2. a wall selected, so both of its faces are dimensioned -------------- */
    await tab(page, 'Outline')
    // the Outline lists every wall; the longest one shows the two faces best
    const walls = page.locator('button', { hasText: /^Wall/ })
    const count = await walls.count()
    let best = 0
    let bestLen = 0
    for (let i = 0; i < count; i++) {
      const text = (await walls.nth(i).innerText()).match(/([\d.]+) m/)
      const len = text ? Number(text[1]) : 0
      if (len > bestLen) {
        bestLen = len
        best = i
      }
    }
    await walls.nth(best).click()
    await tab(page, 'Properties')
    await wait(page, 500)
    await shot(page, 'ui-wall')

    /* 3. a room selected, with its three areas ------------------------------ */
    await tab(page, 'Outline')
    await page.locator('button', { hasText: 'Salón' }).first().click()
    await tab(page, 'Properties')
    await wait(page, 500)
    await shot(page, 'ui-room')

    /* 4. where the figures are measured from -------------------------------- */
    await tab(page, 'Settings')
    await wait(page, 400)
    await shot(page, 'ui-settings')

    /* 5. the catalogue ------------------------------------------------------ */
    await tab(page, 'Catalog')
    await wait(page, 400)
    await shot(page, 'ui-catalog')

    /* 6. the 3D view, pulled in a little ------------------------------------ */
    await tab(page, 'Properties')
    await page.keyboard.press('2')
    await wait(page, 4000)
    await page.mouse.move(SIZE.width / 2 - 180, SIZE.height / 2)
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, -220)
      await wait(page, 220)
    }
    await wait(page, 900)
    await shot(page, 'ui-3d')

    /* 7. walking through it -------------------------------------------------- */
    await page.keyboard.press('3')
    await wait(page, 3200)
    await shot(page, 'ui-walk')
    await context.close()
  }

  /* 7. a clip: orbiting the model in 3D ------------------------------------- */
  {
    const { context, page } = await open(true)
    await page.keyboard.press('2')
    await wait(page, 4000)
    const box = { x: SIZE.width / 2 - 140, y: SIZE.height / 2 }
    await page.mouse.move(box.x, box.y)
    await page.mouse.wheel(0, -420)
    await wait(page, 400)
    await page.mouse.down()
    for (let i = 0; i < 40; i++) {
      await page.mouse.move(box.x + i * 9, box.y + Math.sin(i / 10) * 22)
      await wait(page, 30)
    }
    await page.mouse.up()
    await wait(page, 700)
    await context.close()
  }

  /* 8. a clip: switching what the figures are measured from ----------------- */
  {
    const { context, page } = await open(true)
    await tab(page, 'Settings')
    await wait(page, 900)
    for (const basis of ['Centre', 'Exterior', 'Interior', 'Centre', 'Exterior', 'Interior']) {
      await page.getByRole('button', { name: basis, exact: true }).click()
      await wait(page, 900)
    }
    await context.close()
  }

  await browser.close()
  stop()

  const videos = readdirSync(work)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => join(work, f))
    .sort((a, b) => statSync(a).birthtimeMs - statSync(b).birthtimeMs)
  // README-sized: a clip nobody waits to download
  videos.forEach((v, i) => copyFileSync(v, join(keep, `clip-${i}.webm`)))
  if (videos[0]) clipToWebp(videos[0], 'ui-orbit', { start: 6, seconds: 5, fps: 10, width: 900, quality: 35 })
  if (videos[1]) clipToWebp(videos[1], 'ui-basis', { start: 1.2, seconds: 6.4, fps: 4, width: 900, quality: 45 })

  console.log(`screenshots written to docs/ (${videos.length} clips)`)
  rmSync(work, { recursive: true, force: true })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
