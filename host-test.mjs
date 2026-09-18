#!/usr/bin/env node
/**
 * host-test.mjs — exercise the host half with a stub cordis context.
 *
 * Checks the two things the browser cannot tell us until it is too late: that
 * the settings namespace registers with a schema that actually validates, and
 * that the pre-paint injection carries the right palette for the right mode in
 * the right order.
 *
 * Run: node host-test.mjs
 */
import { apply } from './host.js'
import {
  NAMESPACE, PRESET_ATTRIBUTE, PRESET_FIELD,
} from './src/plugin.mjs'
import { DEFAULT_PRESET_ID, PRESETS } from './presets.mjs'

const failures = []
const passed = []

/** Assert one condition. */
function check(ok, label, detail = '') {
  if (ok) passed.push(label)
  else failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`)
}

const registered = []
let injectHandler

/** Build a context whose settings section holds `preset`. */
function harness(preset) {
  const section = preset === undefined ? undefined : { [PRESET_FIELD]: preset }
  const settings = {
    register(namespace, schema) { registered.push({ namespace, schema }) },
    get(namespace) { return namespace === NAMESPACE ? section : undefined },
  }
  return {
    inject(deps, callback) { callback({ ...this, settings }) },
    get(name) { return name === 'settings' ? settings : undefined },
    on(event, handler) {
      if (event === 'webserver/index-inject') injectHandler = handler
      return () => {}
    },
  }
}

// --- registration ------------------------------------------------------------
// The namespace MUST register before apply()'s first await. The client's
// settings mirror reads describe at startup and never re-reads an unregistered
// namespace, so a late registration leaves the client scope at `loading`
// forever: the settings row still renders and writes still work, but a reload
// keeps the pre-paint palette and the browser half never takes over. That
// failure mode is invisible to every other check in this file, which is exactly
// why this one asserts on the synchronous phase.
{
  const syncRegistered = []
  const syncCtx = {
    inject(deps, callback) {
      callback({ settings: { register: (ns, schema) => syncRegistered.push({ ns, schema }) }, get: () => undefined })
    },
    get: () => undefined,
    on: () => () => {},
  }
  const pending = apply(syncCtx)
  check(syncRegistered.length === 1 && syncRegistered[0].ns === NAMESPACE,
    'registers the namespace synchronously, before any await',
    `registered so far: ${syncRegistered.map(r => r.ns).join(', ') || '(none)'}`)
  await pending
  check(syncRegistered.length === 1, 'does not register a second time after apply resolves')
}

await apply(harness(DEFAULT_PRESET_ID))
check(injectHandler !== undefined, 'listens for webserver/index-inject')
check(registered.length === 1 && registered[0].namespace === NAMESPACE,
  'registers the theme-presets namespace', JSON.stringify(registered.map(r => r.namespace)))

const schema = registered[0].schema
check(typeof schema.toJSON === 'function', 'registers a schema the settings descriptor can serialize')
check(JSON.stringify(schema({})) === JSON.stringify({ [PRESET_FIELD]: DEFAULT_PRESET_ID }),
  'schema defaults to the default preset')
for (const preset of PRESETS) {
  check(JSON.stringify(schema({ [PRESET_FIELD]: preset.id }))
    === JSON.stringify({ [PRESET_FIELD]: preset.id }), `schema accepts "${preset.id}"`)
}
// A stale id must not fail registration: settings judges the stored section
// when the namespace registers, so throwing here would strand anyone whose
// saved preset was renamed or removed. Falling back keeps the row mountable.
check(JSON.stringify(schema({ [PRESET_FIELD]: 'not-a-preset' }))
  === JSON.stringify({ [PRESET_FIELD]: DEFAULT_PRESET_ID }),
  'schema falls back for an unknown preset id instead of rejecting it')

// --- injection: a real preset ------------------------------------------------
{
  await apply(harness('nord'))
  const table = []
  injectHandler(table)
  check(table.length === 2, 'injects a style row and a body script row', `got ${table.length}`)

  const [style, script] = table
  check(style.kind === 'style' && !('placement' in style), 'style row is head-scoped')
  check(script.kind === 'script' && script.placement === 'body', 'script row runs in the body')

  const selector = `html body[${PRESET_ATTRIBUTE}="nord"]`
  check(style.text.startsWith(`${selector}{`), 'light rule comes first and is attribute-keyed')
  check(style.text.includes(`${selector}[data-ds-dark-theme]{`), 'dark rule is keyed off the palette selector')
  check(style.text.indexOf(`${selector}{`) < style.text.indexOf(`${selector}[data-ds-dark-theme]{`),
    'dark rule follows the light one so it wins on attribute match')

  const lightPart = style.text.slice(0, style.text.indexOf(`${selector}[data-ds-dark-theme]{`))
  const darkPart = style.text.slice(style.text.indexOf(`${selector}[data-ds-dark-theme]{`))
  check(lightPart.includes('--dsw-alias-bg-base:#eceff4'), 'light rule carries the Snow Storm canvas')
  check(darkPart.includes('--dsw-alias-bg-base:#2e3440'), 'dark rule carries the Polar Night canvas')
  check(lightPart.includes('background-color:var(--dsw-alias-bg-base)'), 'light rule paints the canvas')
  check(darkPart.includes('background-color:var(--dsw-alias-bg-base)'), 'dark rule paints the canvas')
  check(!style.text.includes('</style'), 'style text cannot close its own element early')
  check(!script.text.includes('</script'), 'script text cannot close its own element early')

  check(script.text.includes(JSON.stringify(PRESET_ATTRIBUTE)), 'script sets the preset attribute')
  check(script.text.includes('document.body.setAttribute('), 'script writes to the body, not the head')
  check(script.text.includes('"nord"'), 'script carries the selected preset id')
}

// --- injection: the default preset ------------------------------------------
{
  await apply(harness(DEFAULT_PRESET_ID))
  const table = []
  injectHandler(table)
  check(table.length === 0, 'the default preset injects nothing at all', `got ${table.length}`)
}

// --- injection: no settings provider (headless) ------------------------------
{
  const before = registered.length
  const headless = {
    // Cordis never invokes the callback while the dependency is absent, so a
    // headless composition simply never registers the namespace.
    inject() {},
    get() { return undefined },
    on(event, handler) {
      if (event === 'webserver/index-inject') injectHandler = handler
      return () => {}
    },
  }
  await apply(headless)
  check(registered.length === before, 'a headless host registers no namespace')
  const table = []
  injectHandler(table)
  check(table.length === 0, 'a headless host injects nothing instead of throwing')
}

// --- every preset round-trips through the injection ---------------------------
{
  for (const preset of PRESETS) {
    await apply(harness(preset.id))
    const table = []
    injectHandler(table)
    const ok = table.length === 2 && table[0].text.includes(`"${preset.id}"`) && table[1].text.includes(`"${preset.id}"`)
    check(ok, `"${preset.id}" injects a complete pre-paint pair`)
  }
}

for (const line of passed) console.log(`  ok   ${line}`)
for (const line of failures) console.log(`  FAIL ${line}`)
console.log(failures.length === 0
  ? `\nPASS — ${passed.length} checks`
  : `\nFAIL — ${failures.length} of ${passed.length + failures.length} checks`)
process.exit(failures.length === 0 ? 0 : 1)
