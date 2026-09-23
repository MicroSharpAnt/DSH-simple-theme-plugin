/** Host index injection, with palette data refreshed when presets.mjs changes. */
import { statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createPresetSchema } from './schema.mjs'

export { createPresetSchema }

/** Settings namespace owning the durable preset selection. */
export const NAMESPACE = 'theme-presets'

/** Field carrying the selected preset id. */
export const PRESET_FIELD = 'preset'

/** Body attribute the boot injection keys its rules off. */
export const PRESET_ATTRIBUTE = 'data-dsh-theme-preset'

/** Body attribute selecting the dark base palette (owned by ui-theme/ui-layout). */
const DARK_ATTRIBUTE = 'data-ds-dark-theme'

const here = dirname(fileURLToPath(import.meta.url))
const presetsPath = join(here, '..', 'presets.mjs')
const presetsUrl = pathToFileURL(presetsPath).href

/** Last loaded `presets.mjs`, keyed by its file revision. */
let cachedPresets

/**
 * Import `presets.mjs` at its current revision.
 *
 * `presets.mjs` is the shared source of truth for both halves and the only file
 * a user edits to retune colors, so it is loaded through an mtime-keyed
 * specifier rather than a static import, which would freeze it in the module
 * cache for the life of the process.
 * @returns {Promise<object>} the module.
 */
export async function loadPresets() {
  const stat = statSync(presetsPath)
  const key = `${stat.mtimeMs}-${stat.size}`
  if (cachedPresets !== undefined && cachedPresets.key === key) return cachedPresets.module
  const module = await import(`${presetsUrl}?v=${key}`)
  cachedPresets = { key, module }
  return module
}

/**
 * The currently loaded `presets.mjs`, or undefined before the first load.
 *
 * The index-injection handler runs synchronously and cannot await, so it reads
 * this cache and warms the next render when it is still empty (the first render
 * can beat the initial import).
 * @returns {object|undefined} the loaded module.
 */
export function currentPresets() {
  return cachedPresets?.module
}

/**
 * Build the boot style for one preset.
 *
 * Both rules are `(0,1,2)`-specific so they outrank the base stylesheets'
 * `body[data-ds-dark-theme]` token block without `!important`, which would
 * otherwise stop the browser half's own inline layer from taking over. The dark
 * rule follows the light one, so it wins once ui-theme's boot script has set the
 * attribute — the two scripts need no ordering guarantee, because CSS matching
 * is retroactive to the attribute write.
 * @param {object} presets - the loaded `presets.mjs` module.
 * @param {string} preset - preset id.
 * @returns {string} CSS text, or an empty string when there is nothing to inject.
 */
function bootStyle(presets, preset) {
  const light = presets.presetCss(preset, 'light')
  const dark = presets.presetCss(preset, 'dark')
  if (light === '' || dark === '') return ''
  const selector = `html body[${PRESET_ATTRIBUTE}="${preset}"]`
  return `${selector}{${light};background-color:var(--dsw-alias-bg-base)}`
    + `${selector}[${DARK_ATTRIBUTE}]{${dark};background-color:var(--dsw-alias-bg-base)}`
}

/**
 * Append this preset's pre-paint layer to one index response.
 *
 * Synchronous by contract: the webserver emits `index-inject` synchronously
 * while rendering, so an async handler would push its rows after the response
 * was already assembled.
 * @param {Array<object>} table - the injection rows to append to.
 * @param {object} presets - the loaded `presets.mjs` module.
 * @param {string} preset - current live preset id.
 */
export function injectPreset(table, presets, preset) {
  // `statSync` is cheap and this runs once per index render; when the palette
  // file changed under a running process, warm the new revision so the next
  // render uses it instead of requiring a reload.
  try {
    const stat = statSync(presetsPath)
    if (cachedPresets !== undefined && cachedPresets.key !== `${stat.mtimeMs}-${stat.size}`) {
      void loadPresets().catch(() => {})
    }
  } catch { /* the file is owned by the deployment; a read failure keeps the current revision */ }

  const fallback = presets.DEFAULT_PRESET_ID
  if (preset === fallback) return
  const style = bootStyle(presets, preset)
  if (style === '') return
  table.push(
    { kind: 'style', text: style },
    {
      kind: 'script',
      placement: 'body',
      text: `document.body.setAttribute(${JSON.stringify(PRESET_ATTRIBUTE)},${JSON.stringify(preset)})`,
    },
  )
}
