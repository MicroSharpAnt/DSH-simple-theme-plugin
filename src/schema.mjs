/** Minimal Cordis Config schema for a git-installed plugin. */

/** The field name the preset id lives under. */
const FIELD = 'preset'

/**
 * Build the Config schema Cordis validates and Settings exposes as a live form.
 * Missing and removed preset ids resolve to the default.
 *
 * @param {readonly string[]} ids - accepted preset ids.
 * @param {string} fallback - id used when the field is missing or unrecognized.
 * @returns {Function} a Standard Schema with a Schemastery-compatible descriptor.
 */
export function createPresetSchema(ids, fallback) {
  const allowed = new Set(ids)

  /** Resolve one merged section into the namespace value. */
  const schema = (value) => {
    const section = value === null || typeof value !== 'object' ? {} : value
    const stored = section[FIELD]
    const preset = typeof stored === 'string' && allowed.has(stored) ? stored : fallback
    let current = preset
    return { [FIELD]: Object.freeze({
      get: () => current,
      [Symbol.for('cosmokit.volatile.write')]: (next) => { current = next },
    }) }
  }

  schema.toJSON = () => presetSchemaJson(ids, fallback)
  schema.type = 'object'
  schema.meta = { default: {} }
  schema.dict = {
    [FIELD]: {
      type: 'union',
      meta: { default: fallback, volatile: true },
      toJSON: () => {
        const json = presetSchemaJson(ids, fallback)
        return { ...json, uid: json.refs[json.uid].dict[FIELD] }
      },
    },
  }
  schema['~standard'] = {
    version: 1,
    vendor: 'dsh-theme-presets',
    validate: (value) => ({ value: schema(value) }),
  }
  return schema
}

/**
 * Describe the namespace for the settings descriptor, in the shape the settings
 * UI actually parses.
 *
 * This has to match schemastery's `toJSON()` byte for byte in structure, not
 * merely describe the same thing: the client half decodes the descriptor by
 * walking `refs` and following the numeric ids in `list`/`dict`. An earlier
 * version of this function emitted a flatter, self-evidently-equivalent object
 * and the row silently never adopted its stored value — the schema was
 * rejected at decode time, so the configuration form never reached `ready`.
 *
 * Reference shape, verified against the real library:
 * `{"uid":8,"refs":{"2":{"type":"const","meta":{"required":true},"value":"default"},
 *   ...,"7":{"type":"union","meta":{"default":"default"},"list":[2,4,6]},
 *   "8":{"type":"object","meta":{"default":{}},"dict":{"preset":7}}}}`
 *
 * @param {readonly string[]} ids - accepted preset ids.
 * @param {string} fallback - the default id.
 * @returns {object} a JSON-safe description matching the reference shape.
 */
export function presetSchemaJson(ids, fallback) {
  const refs = {}
  let uid = 1
  const nextId = () => ++uid

  const constIds = ids.map((value) => {
    const id = nextId()
    refs[id] = { type: 'const', meta: { required: true }, value }
    return id
  })
  const unionId = nextId()
  refs[unionId] = { type: 'union', meta: { default: fallback, volatile: true }, list: constIds }
  const objectId = nextId()
  refs[objectId] = { type: 'object', meta: { default: {} }, dict: { [FIELD]: unionId } }

  return { uid: objectId, refs }
}
