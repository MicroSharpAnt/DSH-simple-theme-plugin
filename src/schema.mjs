/**
 * dsh-theme-presets — the settings schema, without a schema library.
 *
 * `@deepseek-ai/schemastery` is private to the dsh checkout: every internal use
 * is `workspace:^` and it is on no registry, so a plugin installed from git
 * cannot import it. The settings service uses only two things from a schema
 * (`packages/settings/settings/src/index.ts`):
 *
 *   L748  `schema(mergeLayers(base, section))`  — validate, default, return T
 *   L520  `schema.toJSON()`                     — describe the shape for the UI
 *
 * That is a small enough surface to implement exactly, and implementing it here
 * beats depending on an unreleased package: `npm install <git-url>` then works
 * with no extra setup.
 */

/** The field name the preset id lives under. */
const FIELD = 'preset'

/**
 * Build the schema the settings service resolves this namespace with.
 *
 * Two deliberate behaviours, both about not taking the row down:
 *
 *  - **A missing field defaults.** `settings` merges the composition base and
 *    the stored section before calling, so an absent section arrives as `{}` or
 *    `undefined`; that must resolve, not throw.
 *  - **An unknown id falls back instead of rejecting.** `register` judges the
 *    stored section at registration time and a throw there fails the whole
 *    namespace. A preset renamed or removed in a later version would otherwise
 *    strand anyone who had it selected, with no way back through the UI. Falling
 *    back keeps the plugin mountable and lets the person pick again.
 *
 * @param {readonly string[]} ids - accepted preset ids.
 * @param {string} fallback - id used when the field is missing or unrecognized.
 * @returns {((value: unknown) => { preset: string }) & { toJSON: () => object }} the schema.
 */
export function createPresetSchema(ids, fallback) {
  const allowed = new Set(ids)

  /** Resolve one merged section into the namespace value. */
  const schema = (value) => {
    const section = value === null || typeof value !== 'object' ? {} : value
    const stored = section[FIELD]
    const preset = typeof stored === 'string' && allowed.has(stored) ? stored : fallback
    return { [FIELD]: preset }
  }

  schema.toJSON = () => presetSchemaJson(ids, fallback)
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
 * rejected at decode time, so `settingsScope` never reached `ready`.
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
  refs[unionId] = { type: 'union', meta: { default: fallback }, list: constIds }
  const objectId = nextId()
  refs[objectId] = { type: 'object', meta: { default: {} }, dict: { [FIELD]: unionId } }

  return { uid: objectId, refs }
}
