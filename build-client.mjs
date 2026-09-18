#!/usr/bin/env node
/**
 * build-client.mjs — generate `lib/client.js` from `presets.mjs` and
 * `src/runtime.mjs`.
 *
 * The browser half cannot import anything (a bundle only receives `require` and
 * the platform seed), so the palette data and the runtime source are inlined
 * here. Keeping the runtime as real source in `src/runtime.mjs` means it is
 * still parsed and linted as ordinary JavaScript; this script only serializes
 * it, it never assembles code by hand.
 *
 * Run: node build-client.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PRESET_ID, PRESETS, deriveTokens } from './presets.mjs'
import { install } from './src/runtime.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))

// Token names come from a real derivation, so the client's positional value
// arrays can never drift from the host's token map: both call deriveTokens,
// and a missing key would surface here as an undefined entry.
const tokens = Object.keys(deriveTokens(PRESETS[0].light))
const values = {}
for (const preset of PRESETS) {
  const light = deriveTokens(preset.light)
  const dark = deriveTokens(preset.dark)
  const missing = tokens.filter(name => light[name] === undefined || dark[name] === undefined)
  if (missing.length > 0) {
    throw new Error(`preset "${preset.id}" is missing tokens: ${missing.join(', ')}`)
  }
  values[preset.id] = {
    light: tokens.map(name => light[name]),
    dark: tokens.map(name => dark[name]),
  }
}

const meta = PRESETS.map(preset => ({
  id: preset.id,
  name: preset.name,
  hint: `${preset.lightName} / ${preset.darkName}`,
  preview: {
    light: [preset.light.base, preset.light.accent, preset.light.text],
    dark: [preset.dark.base, preset.dark.accent, preset.dark.text],
  },
}))

const data = {
  defaultId: DEFAULT_PRESET_ID,
  namespace: 'theme-presets',
  attribute: 'data-dsh-theme-preset',
  tokens,
  values,
  meta,
}

const bundle = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tconst React = require("react");
\t\tconst data = ${JSON.stringify(data)};
\t\tconst install = ${install.toString()};
\t\tconst plugin = install(require, React, data);
\t\texports.apply = plugin.apply;
\t\texports.inject = plugin.inject;
\t\treturn module.exports;
\t},
});
`

const outPath = join(here, 'lib', 'client.js')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, bundle)

console.log(`built ${outPath}`)
console.log(`  id        ${pkg.name}`)
console.log(`  presets   ${PRESETS.length} (${PRESETS.map(preset => preset.id).join(', ')})`)
console.log(`  tokens    ${tokens.length}`)
console.log(`  bytes     ${bundle.length}`)
