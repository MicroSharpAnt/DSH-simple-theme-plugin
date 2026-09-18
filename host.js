/**
 * dsh-theme-presets — host entry.
 *
 * Thin, and the only path `cordis.patch.yml` names.
 *
 * Two constraints shape this file, and they pull in opposite directions:
 *
 *  1. **Registration must be synchronous.** The client's settings mirror reads
 *     `settings.describe` at startup and afterwards only when the document
 *     changes or the connection resets. A namespace that registers after that
 *     read is never described again, so the client scope sits at
 *     `status: 'loading'` forever and the browser half — which waits for
 *     `ready` before adopting — never applies the stored preset. The symptom is
 *     sneaky: the settings row renders and writes work, but a reload silently
 *     keeps the pre-paint palette with no client takeover. So the schema is
 *     registered here, before any `await`.
 *
 *  2. **The palettes stay hot-reloadable via `presets.mjs`.** Cordis re-imports
 *     a plugin by absolute path and Node answers a repeated specifier from its
 *     ESM cache, so a statically imported file is frozen for the life of the
 *     process. `src/plugin.mjs` is imported statically (constraint 1 forbids an
 *     `await` on the registration path), but the palette data it needs is
 *     resolved through an mtime-keyed specifier, so retuning `presets.mjs`
 *     still reaches the next index render without a restart.
 *
 * Note the trade-off: edits to `src/plugin.mjs` itself now need a restart (it
 * is statically imported, hence cached). Only `presets.mjs` — the file people
 * actually retune — keeps its hot path.
 */
import { createPresetSchema, currentPresets, injectPreset, loadPresets } from './src/plugin.mjs'
import { DEFAULT_PRESET_ID, PRESET_IDS } from './presets.mjs'

/** The plugin name Cordis reports for this row. */
export const name = 'dsh-theme-presets'

/** Settings namespace owning the durable preset selection. */
const NAMESPACE = 'theme-presets'

/** Field carrying the selected preset id. */
const PRESET_FIELD = 'preset'

/**
 * Mount the plugin.
 *
 * The settings namespace registers synchronously (constraint 1 above). The
 * injection handler is wired with the palette data resolved on demand inside
 * `loadPresets`, so retuning `presets.mjs` reaches the next index render
 * without a reload.
 * @param {object} ctx - host context.
 */
export async function apply(ctx) {
  // Synchronous: must precede the client's describe read.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(NAMESPACE, createPresetSchema(PRESET_IDS, DEFAULT_PRESET_ID))
  })

  ctx.on('webserver/index-inject', (table) => {
    const presets = currentPresets()
    if (presets === undefined) {
      // The first render can beat the initial import; warm it so the next
      // render injects. Nothing is appended this time.
      void loadPresets().catch(() => {})
      return
    }
    try {
      injectPreset(ctx, table, presets, { namespace: NAMESPACE, presetField: PRESET_FIELD })
    } catch { /* a failed injection must never break the index response */ }
  })

  await loadPresets().catch(() => {})
}
