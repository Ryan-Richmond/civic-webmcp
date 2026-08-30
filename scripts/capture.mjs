/**
 * Captures the submission screenshots (PRD section 21) from the production build.
 *
 * Usage: npm run capture
 *
 * Serves dist/ over a throwaway local port, drives a real Chrome through the signature flow, and
 * writes one PNG per required state. Every step asserts on the page's own text, so a drifted UI
 * fails the run loudly instead of quietly producing screenshots of the wrong thing.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { mkdir, readdir } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'audit', 'submission')
const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 2 }
const SETTLE_MS = 1200 // longest staggered transition is 500ms + 7 x 40ms

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json' }

function findChrome() {
  const candidates = []
  const cache = join(homedir(), '.cache', 'puppeteer', 'chrome')
  if (existsSync(cache)) {
    for (const build of readdirSync(cache)) {
      candidates.push(join(cache, build, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'))
    }
  }
  candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  const found = candidates.find((path) => existsSync(path))
  if (!found) throw new Error(`No Chrome found. Looked in:\n${candidates.join('\n')}`)
  return found
}

async function serveDist() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ is missing. Run npm run build first.')
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const file = join(DIST, path === '/' ? 'index.html' : path)
    try {
      const body = await readFile(file)
      response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      response.end(body)
    } catch {
      response.writeHead(404).end('not found')
    }
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  return { server, url: `http://127.0.0.1:${server.address().port}/` }
}

/** Click the button whose visible text contains `text`, failing loudly if it is missing or disabled. */
async function click(page, selector, text) {
  const handle = await page.evaluateHandle((sel, needle) => {
    const match = [...document.querySelectorAll(sel)].find((el) => el.textContent.toLowerCase().includes(needle.toLowerCase()))
    return match ?? null
  }, selector, text)
  const element = handle.asElement()
  if (!element) throw new Error(`No ${selector} containing "${text}"`)
  if (await element.evaluate((el) => el.disabled)) throw new Error(`Control "${text}" is disabled`)
  await element.click()
  await new Promise((done) => setTimeout(done, SETTLE_MS))
}

/** innerText reflects CSS text-transform, so compare case-insensitively. */
async function expectText(page, needle) {
  const present = await page.evaluate((text) => document.body.innerText.toLowerCase().includes(text.toLowerCase()), needle)
  if (!present) throw new Error(`Expected the page to show "${needle}"`)
}

async function shoot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  console.log(`  captured ${name}.png`)
}

const { server, url } = await serveDist()
await mkdir(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, defaultViewport: VIEWPORT })

try {
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  page.on('response', (response) => { if (!response.ok()) consoleErrors.push(`${response.status()} ${response.url()}`) })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await new Promise((done) => setTimeout(done, SETTLE_MS))

  console.log('capturing the signature flow:')
  await expectText(page, 'Harbor City')
  await expectText(page, 'Fictional city')
  await shoot(page, '01-baseline')

  // PRD section 20: a normal visual state must update within 200ms of a completed engine result.
  const latency = await page.evaluate(async () => {
    const value = () => document.querySelector('.program-value').textContent
    const before = value()
    const start = performance.now()
    document.querySelectorAll('.harness > button')[0].click()
    for (let i = 0; i < 400; i += 1) {
      if (value() !== before) return performance.now() - start
      await new Promise((done) => setTimeout(done, 1))
    }
    return Number.POSITIVE_INFINITY
  })
  if (!(latency < 200)) throw new Error(`Visual update took ${latency}ms, over the 200ms budget`)
  console.log(`  staged proposal visible ${latency.toFixed(1)}ms after the click`)
  await new Promise((done) => setTimeout(done, SETTLE_MS))
  await expectText(page, '19.5')
  await shoot(page, '02-first-proposal')

  await click(page, '.scenario-actions button', 'Pin 3 human values')
  await expectText(page, 'cannot be accepted until the agent revises')
  await shoot(page, '03-human-pins')

  await click(page, '.harness > button', 'Keep parks, youth and libraries')
  await expectText(page, '$112.4M')
  await shoot(page, '04-infeasible')

  await click(page, '.harness > button', 'Drop the hard targets')
  await expectText(page, 'Within the pins')
  await shoot(page, '05-revision-within-pins')

  await click(page, '.scenario-actions button', 'Accept scenario')
  await click(page, '.inspector-tabs button', 'Decision receipt')
  await expectText(page, 'Accepted by a human')
  await expectText(page, 'HUMAN PINS HELD')
  await shoot(page, '06-accepted-receipt')

  // PRD section 20: the demo flow must run with no uncaught console errors.
  if (consoleErrors.length > 0) throw new Error(`Console errors during the flow:\n${consoleErrors.join('\n')}`)

  console.log(`\n${(await readdir(OUT)).filter((f) => f.endsWith('.png')).length} screenshots in audit/submission/ at ${VIEWPORT.width}x${VIEWPORT.height} css px, ${VIEWPORT.deviceScaleFactor}x scale`)
} finally {
  await browser.close()
  server.close()
}
