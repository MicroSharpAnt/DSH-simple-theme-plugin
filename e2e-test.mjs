#!/usr/bin/env node
/**
 * e2e-test.mjs — drive the live GUI in a real browser.
 *
 * The other suites test the two halves in isolation. This one is the only check
 * that the halves actually hand off to each other on a real page: it selects a
 * preset, watches the client take over, reloads to confirm the pre-paint layer
 * paints first, and restores the default.
 *
 * Deliberately NOT part of `npm test` — it needs a running `dsh web`, Google
 * Chrome, and playwright, and it briefly changes the visible theme.
 *
 * Run: node e2e-test.mjs
 * This suite is developer-only: it needs a running `dsh web` and playwright,
 * neither of which is a dependency of this package. Point it at your checkout
 * with DSH_CHECKOUT (defaults to a sibling `deepseek-harness` directory).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Locate the dsh checkout without baking a machine-specific path into a public repo. */
function resolveCheckout() {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    process.env.DSH_CHECKOUT,
    join(here, '..', 'deepseek-harness'),
    join(homedir(), 'git', 'deepseek-harness'),
  ].filter(candidate => typeof candidate === 'string' && candidate !== '')
  const found = candidates.find(candidate => existsSync(join(candidate, '.dsh-build')))
  if (found === undefined) {
    console.error('FAIL — cannot find the dsh checkout; set DSH_CHECKOUT=/path/to/deepseek-harness')
    process.exit(1)
  }
  return found
}

/** Resolve playwright out of the checkout's pnpm store, at whatever version is there. */
function resolvePlaywright(checkout) {
  const store = join(checkout, 'node_modules', '.pnpm')
  const entry = existsSync(store)
    ? readdirSync(store).filter(name => /^playwright@\d/.test(name)).sort().pop()
    : undefined
  if (entry === undefined) {
    console.error(`FAIL — no playwright in ${store}; this suite is optional, skip it`)
    process.exit(1)
  }
  return join(store, entry, 'node_modules', 'playwright', 'index.mjs')
}

const checkout = resolveCheckout()
const serviceLog = join(checkout, '.dsh-build', 'recovered-service.log')
const settingsFile = join(homedir(), '.dsh', 'settings.yaml')

/** Nord's Snow Storm base, i.e. what the light palette must resolve to. */
const NORD_LIGHT_BASE = '#eceff4'

const failures = []
const passed = []
/** Assert one condition. */
function check(ok, label, detail = '') {
  if (ok) passed.push(label)
  else failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`)
}

const log = readFileSync(serviceLog, 'utf8')
const token = /token=([A-Za-z0-9_-]+)/.exec(log)?.[1]
if (token === undefined) {
  console.error(`FAIL — no launch token in ${serviceLog}; is dsh web running?`)
  process.exit(1)
}

const { chromium } = await import(resolvePlaywright(checkout))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const problems = []
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()) })

/** Read the two theme layers as the browser currently has them. */
const read = () => page.evaluate(() => ({
  attr: document.body.getAttribute('data-dsh-theme-preset'),
  inline: document.body.style.getPropertyValue('--dsw-alias-bg-base').trim(),
}))
/** The preset recorded in settings.yaml, or '(none)'. */
const persisted = () => /theme-presets:\s*\n\s*preset:\s*(\S+)/.exec(readFileSync(settingsFile, 'utf8'))?.[1] ?? '(none)'
const openSettings = async () => {
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.waitForTimeout(2000)
}
/** Open the dialog only when it is not already showing (a reload closes it). */
const openSettingsOrStay = async () => {
  if (await page.evaluate(() => document.querySelector('[role=dialog]') !== null)) return
  await openSettings()
}

try {
  await page.goto(`http://127.0.0.1:3080/?token=${token}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(6000)

  await openSettings()
  const rowVisible = await page.evaluate(() =>
    (document.querySelector('[role=dialog]') ?? document.body).innerText.includes('主题预设'))
  check(rowVisible, 'settings → 通用 shows the 主题预设 row')
  for (const name of ['默认', 'Nord', 'Dracula', 'Catppuccin', 'Tokyo Night', 'One Dark', 'Gruvbox', 'Solarized', 'GitHub']) {
    check(await page.getByText(name, { exact: true }).first().isVisible(), `preset option "${name}" is offered`)
  }

  // Capture the entry state so the suite can put it back: this runs against a
  // real profile, and the person's own selection is not ours to overwrite.
  const entryPreset = persisted()
  const entryName = entryPreset === 'default'
    ? '默认'
    : (/^[a-z]+$/.test(entryPreset)
        ? entryPreset.charAt(0).toUpperCase() + entryPreset.slice(1)
        : entryPreset)
  const before = await read()
  if (entryPreset === 'default') {
    check(before.inline === '' && before.attr === null, 'default preset leaves the token layer untouched',
      JSON.stringify(before))
  } else {
    check(before.inline !== '', `an already-selected preset (${entryPreset}) is already applied`, JSON.stringify(before))
  }

  // Switch away first, so selecting Nord is a real transition regardless of
  // what was stored on entry.
  if (entryPreset !== 'default') {
    await openSettingsOrStay()
    await page.getByText('默认', { exact: true }).first().click()
    await page.waitForTimeout(1500)
  }

  if (entryName !== 'Nord') {
    await openSettingsOrStay()
    await page.getByText('Nord', { exact: true }).first().click()
    await page.waitForTimeout(1500)
  }
  const selected = await read()
  check(selected.inline === NORD_LIGHT_BASE, 'selecting Nord applies the palette through the client half',
    `inline=${JSON.stringify(selected.inline)}`)
  check(selected.attr === null, 'the client half hands off by clearing the body attribute')
  check(persisted() === 'nord', 'the selection is persisted to settings.yaml', persisted())

  await page.reload({ waitUntil: 'domcontentloaded' })
  const prepaint = await read()
  check(prepaint.attr === 'nord', 'after a reload the pre-paint layer restores the attribute before the client runs',
    JSON.stringify(prepaint))
  check(prepaint.inline === '', 'the pre-paint layer is styled by injected CSS, not by inline tokens')

  await page.waitForTimeout(4500)
  const afterClient = await read()
  check(afterClient.inline === NORD_LIGHT_BASE, 'the client half takes over with the same value',
    `inline=${JSON.stringify(afterClient.inline)}`)
  check(afterClient.inline === NORD_LIGHT_BASE && prepaint.attr === 'nord',
    'both layers agree, so the handoff cannot flash a different color')
  check(await page.evaluate(() =>
    [...document.querySelectorAll('style')].some(s => (s.textContent ?? '').includes('html body[data-dsh-theme-preset='))),
  'the injected <style> remains in the document after handoff')

  // Restore the entry selection, whatever it was.
  await openSettingsOrStay()
  await page.getByText(entryName, { exact: true }).first().click()
  await page.waitForTimeout(1500)
  const restored = await read()
  check(persisted() === entryPreset, `the entry selection is restored (${entryPreset})`, persisted())
  if (entryPreset === 'default') {
    check(restored.inline === '' && restored.attr === null, 'restoring 默认 clears the override again')
  } else {
    check(restored.inline !== '', 'restoring a preset reapplies it')
  }

  check(problems.length === 0, 'no console or page errors', problems.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

for (const line of passed) console.log(`  ok   ${line}`)
for (const line of failures) console.log(`  FAIL ${line}`)
console.log(failures.length === 0
  ? `\nPASS — ${passed.length} checks`
  : `\nFAIL — ${failures.length} of ${passed.length + failures.length} checks`)
process.exit(failures.length === 0 ? 0 : 1)
