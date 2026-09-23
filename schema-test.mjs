#!/usr/bin/env node
/** Cordis Config and Settings descriptor checks. */
import { strict as assert } from 'node:assert'
import { createPresetSchema } from './src/schema.mjs'

const ids = ['default', 'nord', 'dracula']
const schema = createPresetSchema(ids, 'default')
for (const [raw, expected] of [
  [{}, 'default'], [{ preset: 'nord' }, 'nord'],
  [{ preset: 'removed' }, 'default'], [undefined, 'default'],
]) {
  const result = schema['~standard'].validate(raw)
  assert.equal(result.value.preset.get(), expected)
  assert.equal(schema(raw).preset.get(), expected)
}
const ref = schema({ preset: 'nord' }).preset
ref[Symbol.for('cosmokit.volatile.write')]('dracula')
assert.equal(ref.get(), 'dracula')
const json = schema.toJSON()
assert.equal(schema.type, 'object')
assert.equal(schema.dict.preset.meta.volatile, true)
assert.equal(schema.dict.preset.toJSON().refs[schema.dict.preset.toJSON().uid].type, 'union')
const root = json.refs[json.uid]
assert.equal(root.type, 'object')
const union = json.refs[root.dict.preset]
assert.equal(union.type, 'union')
assert.equal(union.meta.default, 'default')
assert.equal(union.meta.volatile, true)
assert.deepEqual(union.list.map(id => json.refs[id].value), ids)
assert.deepEqual(JSON.parse(JSON.stringify(json)), json)
console.log('PASS — Config validation and volatile descriptor')
