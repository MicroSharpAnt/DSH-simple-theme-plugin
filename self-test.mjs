#!/usr/bin/env node
/**
 * self-test.mjs — exercise the browser half's logic in-process, with a stub
 * cordis context and a stub DOM, before anything touches a real page.
 *
 * It covers the three behaviours that are easy to get subtly wrong and hard to
 * see in a browser: when adoption is deferred, what the override layer contains,
 * and whether the host's pre-paint attribute is actually dropped.
 *
 * Run: node self-test.mjs
 */
import { DEFAULT_PRESET_ID, PRESETS, deriveTokens } from './presets.mjs'
import { install } from './src/runtime.mjs'

const failures = []
const passed = []

/** Assert one condition. */
function check(ok, label, detail = '') {
  if (ok) passed.push(label)
  else failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`)
}

// --- stub DOM ----------------------------------------------------------------
const appendedStyles = []
const bodyAttributes = new Map()

globalThis.document = {
  createElement(tag) {
    return {
      tag,
      attributes: {},
      textContent: '',
      setAttribute(key, value) { this.attributes[key] = value },
      remove() { this.removed = true },
    }
  },
  head: { append(element) { appendedStyles.push(element) } },
  body: {
    setAttribute(key, value) { bodyAttributes.set(key, value) },
    removeAttribute(key) { bodyAttributes.delete(key) },
    hasAttribute(key) { return bodyAttributes.has(key) },
  },
}

// --- stub context ------------------------------------------------------------
const effects = []
const slotRegistrations = []
const overrideCalls = []

/** Build a context + scope pair whose status the test can drive. */
function harness({ status = 'ready', preset = DEFAULT_PRESET_ID } = {}) {
  const scopeState = {
    status,
    value: preset === undefined ? undefined : { preset },
  }
  const scopeListeners = new Set()
  const writes = []

  const scope = {
    getSnapshot: () => ({
      status: scopeState.status,
      value: scopeState.status === 'loading' ? undefined : scopeState.value,
      revision: 1,
      writable: true,
      mode: 'host',
    }),
    subscribe(listener) { scopeListeners.add(listener); return () => { scopeListeners.delete(listener) } },
    set: async (field, value) => { writes.push([field, value]); scopeState.value = { preset: value } },
  }

  let scheme = 'light'
  const themeListeners = new Set()

  const ctx = {
    effect(callback) { const disposer = callback(); effects.push(disposer); return () => {} },
    locale: { register(namespace, dict) { ctx.localeRegistrations.push([namespace, dict]) }, regs: [] },
    localeRegistrations: [],
    configForms: { get(entryId) { ctx.boundNamespace = entryId; return scope } },
    theme: {
      getTheme: () => ({ active: { colorScheme: scheme }, preference: scheme, tokens: {} }),
      overrideTokens(source, tokens) { overrideCalls.push({ source, tokens }); return () => {} },
    },
    on(event, callback) {
      if (event === 'theme/change') themeListeners.add(callback)
      return () => {}
    },
    slots: {
      inject(slot, factory) { slotRegistrations.push([slot, factory()]) },
      register(options, component) {
        this.lastRegistration = { options, component }
        return { options, component }
      },
    },
    // test handles
    get writes() { return writes },
    setScheme(next) { scheme = next; for (const l of themeListeners) l({ active: { colorScheme: next } }) },
    pushScope() { for (const l of scopeListeners) l() },
    patchScope(patch) { Object.assign(scopeState, patch); for (const l of scopeListeners) l() },
    boundNamespace: undefined,
  }
  return ctx
}

const tokens = Object.keys(deriveTokens(PRESETS[0].light))
const data = {
  defaultId: DEFAULT_PRESET_ID,
  namespace: 'theme-presets',
  attribute: 'data-dsh-theme-preset',
  tokens,
  values: Object.fromEntries(PRESETS.map((preset) => {
    const light = deriveTokens(preset.light)
    const dark = deriveTokens(preset.dark)
    return [preset.id, {
      light: tokens.map(name => light[name]),
      dark: tokens.map(name => dark[name]),
    }]
  })),
  meta: PRESETS.map(preset => ({
    id: preset.id,
    name: preset.name,
    hint: `${preset.lightName} / ${preset.darkName}`,
    preview: {
      light: [preset.light.base, preset.light.accent, preset.light.text],
      dark: [preset.dark.base, preset.dark.accent, preset.dark.text],
    },
  })),
}

const fakeReact = { createElement: () => ({}), useSyncExternalStore: () => DEFAULT_PRESET_ID }

// --- scenario 1: durable preset already resolved ------------------------------
{
  overrideCalls.length = 0
  bodyAttributes.set('data-dsh-theme-preset', 'nord')
  const ctx = harness({ status: 'ready', preset: 'nord' })
  const plugin = install(() => ({}), fakeReact, data)
  plugin.apply(ctx)

  check(plugin.inject.includes('theme') && plugin.inject.includes('configForms'),
    'plugin declares theme and configForms')
  check(ctx.boundNamespace === 'theme-presets', 'gets the theme-presets form')

  const adopted = overrideCalls.at(-1)
  check(adopted !== undefined && adopted.source === 'theme-presets', 'stacks one override layer')
  check(Object.keys(adopted.tokens).length === data.tokens.length,
    'override layer covers every token', `${Object.keys(adopted.tokens).length}/${data.tokens.length}`)
  check(adopted.tokens['--dsw-alias-bg-base'].light === '#eceff4'
    && adopted.tokens['--dsw-alias-bg-base'].dark === '#2e3440',
    'nord base resolves per mode')
  check(!bodyAttributes.has('data-dsh-theme-preset'), 'drops the host pre-paint attribute')

  const slot = slotRegistrations.at(-1)
  check(slot[0] === 'settings.general.item', 'registers into settings.general.item')
  check(slot[1].options.id === 'theme-presets' && slot[1].options.order === 12, 'row id and order are stable')
  check(appendedStyles.length === 1 && appendedStyles[0].attributes['data-dsh-theme-presets'] === 'styles',
    'injects its own stylesheet')
}

// --- scenario 2: switching a preset ------------------------------------------
{
  overrideCalls.length = 0
  const ctx = harness({ status: 'ready', preset: DEFAULT_PRESET_ID })
  const plugin = install(() => ({}), fakeReact, data)
  plugin.apply(ctx)
  overrideCalls.length = 0

  const injected = slotRegistrations.at(-1)[1].options.inject()
  injected.select('gruvbox')

  const call = overrideCalls.at(-1)
  check(call.tokens['--dsw-alias-bg-base'].dark === '#282828', 'gruvbox dark base applied on switch')
  check(call.tokens['--dsw-alias-bg-base'].light === '#fbf1c7', 'gruvbox light base applied on switch')
  check(ctx.writes.at(-1)[0] === 'preset' && ctx.writes.at(-1)[1] === 'gruvbox',
    'persists the selection through the settings scope')
  check(injected.readPreset() === 'gruvbox', 'row reads the new selection back')
}

// --- scenario 3: defer while the durable value is still loading ---------------
{
  overrideCalls.length = 0
  bodyAttributes.set('data-dsh-theme-preset', 'dracula')
  const ctx = harness({ status: 'loading', preset: undefined })
  const plugin = install(() => ({}), fakeReact, data)
  plugin.apply(ctx)

  check(overrideCalls.length === 0, 'adoption deferred while the scope is loading')
  check(bodyAttributes.get('data-dsh-theme-preset') === 'dracula',
    'host pre-paint layer survives the loading window')

  ctx.patchScope({ status: 'ready', value: { preset: 'dracula' } })
  const adopted = overrideCalls.at(-1)
  check(adopted !== undefined && adopted.tokens['--dsw-alias-bg-base'].dark === '#282a36',
    'adopts dracula once the durable value resolves')
  check(!bodyAttributes.has('data-dsh-theme-preset'), 'drops the host layer only after adopting')
}

// --- scenario 4: an unknown persisted id falls back --------------------------
{
  overrideCalls.length = 0
  const ctx = harness({ status: 'ready', preset: 'not-a-preset' })
  const plugin = install(() => ({}), fakeReact, data)
  plugin.apply(ctx)
  const call = overrideCalls.at(-1)
  check(Object.keys(call.tokens).length === 0, 'unknown preset id falls back to the default palette')
  check(slotRegistrations.at(-1)[1].options.inject().readPreset() === DEFAULT_PRESET_ID,
    'row reports the default for an unknown id')
}

// --- report ------------------------------------------------------------------
for (const line of passed) console.log(`  ok   ${line}`)
for (const line of failures) console.log(`  FAIL ${line}`)
console.log(failures.length === 0
  ? `\nPASS — ${passed.length} checks`
  : `\nFAIL — ${failures.length} of ${passed.length + failures.length} checks`)
process.exit(failures.length === 0 ? 0 : 1)
