#!/usr/bin/env node
/**
 * bundle-test.mjs — execute the built `lib/client.js` exactly as the browser
 * module loader would: install a `window.__ModuleLoader__` stub, let the bundle
 * run, then call its factory with a stub `require`.
 *
 * The other tests exercise `src/runtime.mjs` directly, so they cannot catch a
 * mistake in the generated wrapper — a mis-scoped `require`, an `exports` typo,
 * or data that fails to serialize. This one can, and it is the last check that
 * runs before the bundle is handed to a real page.
 *
 * Run: node bundle-test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const failures = []
const passed = []
/** Assert one condition. */
function check(ok, label, detail = '') {
  if (ok) passed.push(label)
  else failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`)
}

let registration
globalThis.window = {
  __ModuleLoader__: {
    load(entry) { registration = entry },
  },
}

// Execute the bundle the way a classic script tag would.
const source = readFileSync(join(here, 'lib', 'client.js'), 'utf8')
// eslint-disable-next-line no-new-func -- executing the artifact is the point.
new Function(source)()

check(registration !== undefined, 'bundle registers via window.__ModuleLoader__.load')
check(typeof registration.factory === 'function', 'registration carries a factory')

const requireCalls = []
const fakeReact = {
  createElement: () => ({}),
  useSyncExternalStore: () => undefined,
}
const stubRequire = (specifier) => {
  requireCalls.push(specifier)
  if (specifier === 'react') return fakeReact
  throw new Error(`unexpected require("${specifier}") — the bundle should need only the platform seed`)
}

const plugin = registration.factory(stubRequire)

check(requireCalls.length === 1 && requireCalls[0] === 'react',
  'factory requires only react from the seed', requireCalls.join(', '))
check(typeof plugin.apply === 'function', 'exports a callable apply')
check(Array.isArray(plugin.inject), 'exports an inject list')
check(plugin.inject.includes('theme') && plugin.inject.includes('settingsScope'),
  'inject names the services the row needs', JSON.stringify(plugin.inject))

// The bundle must be a plain classic script: ESM syntax would throw in
// `new Function`, and a stray import would break the loader's contract.
check(!/^\s*(import|export)\s/m.test(source), 'bundle contains no ESM syntax')

// Every preset the host can persist must be renderable by this bundle, or a
// selection would silently fall back after a reload.
const idMatch = /"defaultId":"([^"]+)"/.exec(source)
const [presetIds, tokenCount] = (() => {
  const start = source.indexOf('const data = ')
  const json = source.slice(start + 'const data = '.length, source.indexOf(';\n\t\tconst install', start))
  const parsed = JSON.parse(json)
  return [Object.keys(parsed.values), parsed.tokens.length]
})()

check(idMatch !== null && idMatch[1] === 'default', 'bundle carries the default preset id')
check(presetIds.length === 8, 'bundle carries all eight presets', presetIds.join(', '))
check(tokenCount === 92, 'bundle carries the full token surface', String(tokenCount))
check(presetIds.every(id => id.length > 0), 'every preset has a non-empty id')

for (const line of passed) console.log(`  ok   ${line}`)
for (const line of failures) console.log(`  FAIL ${line}`)
console.log(failures.length === 0
  ? `\nPASS — ${passed.length} checks`
  : `\nFAIL — ${failures.length} of ${passed.length + failures.length} checks`)
process.exit(failures.length === 0 ? 0 : 1)
