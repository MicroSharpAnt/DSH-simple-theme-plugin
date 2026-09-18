#!/usr/bin/env node
/**
 * schema-test.mjs — the settings-schema contract, without schemastery.
 *
 * `@deepseek-ai/schemastery` is private to the dsh checkout (every internal
 * use is `workspace:^`), so a plugin installed from git cannot depend on it.
 * The host half therefore carries its own minimal schema.
 *
 * This suite pins the two things `settings.register` actually does with a
 * schema, read off `packages/settings/settings/src/index.ts`:
 *
 *   L748  `schema(mergeLayers(base, section))` — validate and default
 *   L520  `schema.toJSON()`                    — describe the shape for the UI
 *
 * plus the behaviour that matters for a durable selection: a previously stored
 * section must still resolve after the preset list changes, and an unknown id
 * must fall back rather than reject the whole namespace.
 *
 * Run: node schema-test.mjs
 */
import { createPresetSchema, presetSchemaJson } from './src/schema.mjs'

const failures = []
const passed = []
/** Assert one condition. */
function check(ok, label, detail = '') {
  if (ok) passed.push(label)
  else failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`)
}

const IDS = ['default', 'nord', 'dracula']

// --- the callable form: validation and defaulting -------------------------

const schema = createPresetSchema(IDS, 'default')

check(typeof schema === 'function', 'schema is callable (settings resolves it as schema(value))')

{
  const resolved = schema({})
  check(resolved.preset === 'default',
    'an empty section resolves to the default preset', JSON.stringify(resolved))
}
{
  const resolved = schema({ preset: 'nord' })
  check(resolved.preset === 'nord', 'a stored preset survives resolution', JSON.stringify(resolved))
}
{
  const resolved = schema({ preset: 'nord', extra: 1 })
  check(resolved.preset === 'nord' && !('extra' in resolved),
    'unknown fields are dropped rather than carried into the resolved value', JSON.stringify(resolved))
}
{
  const resolved = schema(undefined)
  check(resolved.preset === 'default', 'an absent section still resolves (mergeLayers can pass undefined)')
}

// A stale id must not throw: registering an invalid stored section fails the
// registration itself, which would take the whole row down on a renamed preset.
{
  let outcome
  try {
    outcome = { ok: true, value: schema({ preset: 'no-such-preset' }) }
  } catch (error) {
    outcome = { ok: false, message: error.message }
  }
  check(outcome.ok, 'an unknown preset id does not throw', outcome.message ?? '')
  check(outcome.ok && outcome.value.preset === 'default',
    'an unknown preset id falls back to the default', JSON.stringify(outcome.value))
}

// --- the descriptor form: toJSON ------------------------------------------

{
  const json = schema.toJSON()
  check(json !== undefined && json !== null, 'schema exposes toJSON() for the settings descriptor')
  check(typeof json.uid === 'number' && typeof json.refs === 'object',
    'toJSON uses the reference-table shape (uid + refs), which is what the UI decodes',
    JSON.stringify(json).slice(0, 120))
  const root = json.refs[json.uid]
  check(root?.type === 'object', 'the root ref is the object schema', JSON.stringify(root?.type))
  const fieldRef = root?.dict?.['preset']
  check(typeof fieldRef === 'number', 'dict points at its field by numeric ref', String(fieldRef))
  const union = json.refs[fieldRef]
  check(union?.type === 'union', 'the field ref is a union', JSON.stringify(union?.type))
  check(Array.isArray(union?.list) && union.list.every(entry => typeof entry === 'number'),
    'union.list holds numeric refs, not literals', JSON.stringify(union?.list))
  const literals = (union?.list ?? []).map(id => json.refs[id]?.value)
  check(JSON.stringify(literals) === JSON.stringify(IDS),
    'the union refs resolve to exactly the accepted ids', JSON.stringify(literals))
  check(union?.meta?.default === 'default', 'the union carries the default', JSON.stringify(union?.meta))
  // Ids are allocated from a global counter in schemastery, so their values carry
  // no meaning beyond uniqueness inside this table; what matters is that every
  // id in `list`/`dict` resolves within `refs`.
  const dangling = []
  for (const [id, ref] of Object.entries(json.refs)) {
    for (const target of [...(ref.list ?? []), ...Object.values(ref.dict ?? {})]) {
      if (typeof target === 'number' && json.refs[target] === undefined) dangling.push(`${id}->${target}`)
    }
  }
  check(dangling.length === 0, 'every reference resolves inside the table', dangling.join(', '))
}

// The settings UI walks this structure; a flatter but "equivalent" object is
// rejected at decode time, which is how the row silently stopped adopting.
{
  const json = presetSchemaJson(IDS, 'default')
  const serialized = JSON.stringify(json)
  check(JSON.parse(serialized) !== undefined, 'the serialized schema is JSON-safe')
  check(serialized.includes('"uid"') && serialized.includes('"refs"'),
    'the serialized form keeps the uid/refs envelope', serialized.slice(0, 120))
  check(!('dict' in json) || typeof json.dict === 'object',
    'any top-level dict is inside the ref table, not beside it')
}

// --- the value must be structured-cloneable (settings deep-freezes it) ----

{
  const resolved = schema({ preset: 'nord' })
  const cloned = structuredClone(resolved)
  check(cloned.preset === 'nord', 'the resolved value survives structuredClone')
  check(Object.isFrozen(resolved) === false, 'the schema itself does not freeze its result (settings owns freezing)')
}

for (const line of passed) console.log(`  ok   ${line}`)
for (const line of failures) console.log(`  FAIL ${line}`)
console.log(failures.length === 0
  ? `\nPASS — ${passed.length} checks`
  : `\nFAIL — ${failures.length} of ${passed.length + failures.length} checks`)
process.exit(failures.length === 0 ? 0 : 1)
