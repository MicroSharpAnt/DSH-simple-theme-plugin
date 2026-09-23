#!/usr/bin/env node
/** Host Config and pre-paint injection checks. */
import { strict as assert } from 'node:assert'
import { apply, Config } from './host.js'
import { PRESET_ATTRIBUTE } from './src/plugin.mjs'
import { DEFAULT_PRESET_ID, PRESETS } from './presets.mjs'

assert.equal(Config['~standard'].validate({}).value.preset.get(), DEFAULT_PRESET_ID)
for (const preset of PRESETS) {
  assert.equal(Config['~standard'].validate({ preset: preset.id }).value.preset.get(), preset.id)
}
assert.equal(Config['~standard'].validate({ preset: 'removed' }).value.preset.get(), DEFAULT_PRESET_ID)
const json = Config.toJSON()
assert.equal(json.refs[json.refs[json.uid].dict.preset].meta.volatile, true)

let inject
const ctx = { on(event, callback) { if (event === 'webserver/index-inject') inject = callback } }
const config = Config['~standard'].validate({ preset: 'nord' }).value
await apply(ctx, config)
const table = []
inject(table)
assert.equal(table.length, 2)
const [style, script] = table
const selector = `html body[${PRESET_ATTRIBUTE}="nord"]`
assert.equal(style.kind, 'style')
assert.ok(style.text.startsWith(`${selector}{`))
assert.ok(style.text.includes(`${selector}[data-ds-dark-theme]{`))
assert.ok(style.text.includes('--dsw-alias-bg-base:#eceff4'))
assert.ok(style.text.includes('--dsw-alias-bg-base:#2e3440'))
assert.equal(script.kind, 'script')
assert.equal(script.placement, 'body')
assert.ok(script.text.includes('"nord"'))

config.preset[Symbol.for('cosmokit.volatile.write')]('gruvbox')
const updated = []
inject(updated)
assert.equal(updated.length, 2)
assert.ok(updated[0].text.includes('"gruvbox"'))

config.preset[Symbol.for('cosmokit.volatile.write')](DEFAULT_PRESET_ID)
const reset = []
inject(reset)
assert.equal(reset.length, 0)

console.log('PASS — host Config, live update, and pre-paint injection')
