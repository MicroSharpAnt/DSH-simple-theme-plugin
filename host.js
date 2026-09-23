/** Host entry for the theme preset plugin. */
import { createPresetSchema, currentPresets, injectPreset, loadPresets } from './src/plugin.mjs'
import { DEFAULT_PRESET_ID, PRESET_IDS } from './presets.mjs'

/** The plugin name Cordis reports for this row. */
export const name = 'dsh-theme-presets'

/** Live preset selection, persisted by DSH in the active profile patch. */
export const Config = createPresetSchema(PRESET_IDS, DEFAULT_PRESET_ID)

/**
 * Mount the plugin.
 *
 * @param {object} ctx - host context.
 * @param {{ preset: { get: () => string } }} config - validated live config.
 */
export async function apply(ctx, config) {
  ctx.on('webserver/index-inject', (table) => {
    const presets = currentPresets()
    if (presets === undefined) {
      // The first render can beat the initial import; warm it so the next
      // render injects. Nothing is appended this time.
      void loadPresets().catch(() => {})
      return
    }
    try {
      injectPreset(table, presets, config.preset.get())
    } catch { /* a failed injection must never break the index response */ }
  })

  await loadPresets().catch(() => {})
}
