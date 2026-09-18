/**
 * Theme preset data and the alias-token derivation.
 *
 * A preset is a *color family* orthogonal to ui-theme's light/dark/system
 * preference: it carries one palette per mode, and the active preference picks
 * which one applies. Selecting `nord` therefore means "Snow Storm when the
 * preference is light, Polar Night when it is dark".
 *
 * Every palette below is transcribed from the theme's own published palette, so
 * the shipped colors are the real ones rather than an approximation:
 *   - Nord        https://www.nordtheme.com/docs/colors-and-palettes
 *   - Dracula     https://github.com/dracula/dracula-theme (Alucard is the official light pair)
 *   - Catppuccin  https://github.com/catppuccin/catppuccin (Latte / Mocha)
 *   - Tokyo Night https://github.com/folke/tokyonight.nvim (storm palette; `day` is its official invert)
 *   - One Dark    https://github.com/atom/one-dark-syntax (+ one-light-syntax)
 *   - Gruvbox     https://github.com/morhetz/gruvbox
 *   - Solarized   https://ethanschoonover.com/solarized
 *   - GitHub      https://primer.style/foundations/color
 *
 * Only rendered tokens are derived; the DSH design system stays the authority
 * for anything a preset does not name.
 */

/**
 * One mode's base palette: 15 semantic anchors, expanded into every alias token.
 * @typedef {object} Palette
 * @property {string} base Application canvas.
 * @property {string} mantle Recessed chrome behind the canvas (sidebar, document preview).
 * @property {string} surface Primary raised surface (layer-1, dialogs, elevated buttons).
 * @property {string} surfaceAlt Secondary nested surface (layer-2/3, overlays, menus, tooltips).
 * @property {string} fill Subtle fill for code blocks, inputs, selectors, tips.
 * @property {string} text Primary text.
 * @property {string} textMuted Secondary text.
 * @property {string} textFaint Tertiary/caption text.
 * @property {string} border Border base color.
 * @property {string} accent Brand accent (buttons, selection, focus).
 * @property {string} onAccent Foreground drawn on top of `accent`.
 * @property {string} danger Error state.
 * @property {string} success Success state.
 * @property {string} warning Warning state.
 * @property {string} info Link/info/business state.
 */

/**
 * One selectable preset: identity, display copy, and its two mode palettes.
 * @typedef {object} Preset
 * @property {string} id Stable id (the value persisted in settings).
 * @property {string} name Display name (theme names are proper nouns and stay untranslated).
 * @property {string} lightName The light-mode variant's own name, shown as a hint.
 * @property {string} darkName The dark-mode variant's own name, shown as a hint.
 * @property {Palette} light Palette applied while the preference resolves to light.
 * @property {Palette} dark Palette applied while the preference resolves to dark.
 */

/** Preset id for "no preset" — the DSH design-system palette, untouched. */
export const DEFAULT_PRESET_ID = 'default'

/** @type {readonly Preset[]} Every shipped preset, in picker order. */
export const PRESETS = [
  {
    id: 'nord',
    name: 'Nord',
    lightName: 'Snow Storm',
    darkName: 'Polar Night',
    light: {
      base: '#eceff4', mantle: '#e5e9f0', surface: '#ffffff', surfaceAlt: '#f4f6f9',
      fill: '#e5e9f0', text: '#2e3440', textMuted: '#4c566a', textFaint: '#7b88a1',
      border: '#d8dee9', accent: '#5e81ac', onAccent: '#eceff4',
      danger: '#bf616a', success: '#7c9c68', warning: '#c9a227', info: '#5e81ac',
    },
    dark: {
      base: '#2e3440', mantle: '#292e39', surface: '#3b4252', surfaceAlt: '#434c5e',
      fill: '#3b4252', text: '#eceff4', textMuted: '#d8dee9', textFaint: '#8f9bb0',
      border: '#4c566a', accent: '#88c0d0', onAccent: '#2e3440',
      danger: '#bf616a', success: '#a3be8c', warning: '#ebcb8b', info: '#81a1c1',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    lightName: 'Alucard',
    darkName: 'Dracula',
    light: {
      base: '#fffbeb', mantle: '#f4efdc', surface: '#ffffff', surfaceAlt: '#f6f1e0',
      fill: '#f0ebd8', text: '#1f1f1f', textMuted: '#4a4636', textFaint: '#6c664b',
      border: '#dcd6c2', accent: '#644ac9', onAccent: '#fffbeb',
      danger: '#cb3a2a', success: '#14710a', warning: '#846e15', info: '#036a96',
    },
    dark: {
      base: '#282a36', mantle: '#21222c', surface: '#343746', surfaceAlt: '#44475a',
      fill: '#343746', text: '#f8f8f2', textMuted: '#d7d9e3', textFaint: '#6272a4',
      border: '#44475a', accent: '#bd93f9', onAccent: '#282a36',
      danger: '#ff5555', success: '#50fa7b', warning: '#f1fa8c', info: '#8be9fd',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    lightName: 'Latte',
    darkName: 'Mocha',
    light: {
      base: '#eff1f5', mantle: '#e6e9ef', surface: '#ffffff', surfaceAlt: '#dfe2ea',
      fill: '#e6e9ef', text: '#4c4f69', textMuted: '#5c5f77', textFaint: '#8c8fa1',
      border: '#ccd0da', accent: '#8839ef', onAccent: '#ffffff',
      danger: '#d20f39', success: '#40a02b', warning: '#df8e1d', info: '#1e66f5',
    },
    dark: {
      base: '#1e1e2e', mantle: '#181825', surface: '#313244', surfaceAlt: '#45475a',
      fill: '#313244', text: '#cdd6f4', textMuted: '#bac2de', textFaint: '#7f849c',
      border: '#45475a', accent: '#cba6f7', onAccent: '#1e1e2e',
      danger: '#f38ba8', success: '#a6e3a1', warning: '#f9e2af', info: '#89b4fa',
    },
  },
  {
    id: 'tokyonight',
    name: 'Tokyo Night',
    lightName: 'Day',
    darkName: 'Night',
    light: {
      base: '#e1e2e7', mantle: '#d5d6db', surface: '#ffffff', surfaceAlt: '#d3d5dd',
      fill: '#d8dae2', text: '#3760bf', textMuted: '#6172b0', textFaint: '#848cb5',
      border: '#c4c8da', accent: '#2e7de9', onAccent: '#ffffff',
      danger: '#f52a65', success: '#587539', warning: '#8c6c3e', info: '#007197',
    },
    dark: {
      base: '#1a1b26', mantle: '#16161e', surface: '#292e42', surfaceAlt: '#3b4261',
      fill: '#292e42', text: '#c0caf5', textMuted: '#a9b1d6', textFaint: '#565f89',
      border: '#3b4261', accent: '#7aa2f7', onAccent: '#1a1b26',
      danger: '#f7768e', success: '#9ece6a', warning: '#e0af68', info: '#7dcfff',
    },
  },
  {
    id: 'onedark',
    name: 'One Dark',
    lightName: 'One Light',
    darkName: 'One Dark',
    light: {
      base: '#fafafa', mantle: '#f0f0f1', surface: '#ffffff', surfaceAlt: '#eaeaeb',
      fill: '#f0f0f1', text: '#383a42', textMuted: '#696c77', textFaint: '#a0a1a7',
      border: '#dbdbdc', accent: '#4078f2', onAccent: '#ffffff',
      danger: '#e45649', success: '#50a14f', warning: '#c18401', info: '#0184bc',
    },
    dark: {
      base: '#282c34', mantle: '#21252b', surface: '#2c313a', surfaceAlt: '#3b4048',
      fill: '#2c313a', text: '#abb2bf', textMuted: '#9da5b4', textFaint: '#5c6370',
      border: '#3b4048', accent: '#61afef', onAccent: '#282c34',
      danger: '#e06c75', success: '#98c379', warning: '#e5c07b', info: '#56b6c2',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    lightName: 'Light',
    darkName: 'Dark',
    light: {
      base: '#fbf1c7', mantle: '#f2e5bc', surface: '#fffbf0', surfaceAlt: '#ebdbb2',
      fill: '#ebdbb2', text: '#3c3836', textMuted: '#504945', textFaint: '#7c6f64',
      border: '#d5c4a1', accent: '#b57614', onAccent: '#fbf1c7',
      danger: '#9d0006', success: '#79740e', warning: '#af3a03', info: '#076678',
    },
    dark: {
      base: '#282828', mantle: '#1d2021', surface: '#3c3836', surfaceAlt: '#504945',
      fill: '#3c3836', text: '#ebdbb2', textMuted: '#d5c4a1', textFaint: '#928374',
      border: '#504945', accent: '#fabd2f', onAccent: '#282828',
      danger: '#fb4934', success: '#b8bb26', warning: '#fe8019', info: '#83a598',
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    lightName: 'Light',
    darkName: 'Dark',
    light: {
      base: '#fdf6e3', mantle: '#f2ecd9', surface: '#fffcf0', surfaceAlt: '#eee8d5',
      fill: '#eee8d5', text: '#586e75', textMuted: '#657b83', textFaint: '#93a1a1',
      border: '#ded8c4', accent: '#268bd2', onAccent: '#fdf6e3',
      danger: '#dc322f', success: '#859900', warning: '#b58900', info: '#2aa198',
    },
    dark: {
      base: '#002b36', mantle: '#00212a', surface: '#073642', surfaceAlt: '#0e4453',
      fill: '#073642', text: '#93a1a1', textMuted: '#839496', textFaint: '#586e75',
      border: '#0e4453', accent: '#268bd2', onAccent: '#fdf6e3',
      danger: '#dc322f', success: '#859900', warning: '#b58900', info: '#2aa198',
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    lightName: 'Light',
    darkName: 'Dark',
    light: {
      base: '#ffffff', mantle: '#f6f8fa', surface: '#ffffff', surfaceAlt: '#f6f8fa',
      fill: '#f6f8fa', text: '#1f2328', textMuted: '#656d76', textFaint: '#8c959f',
      border: '#d0d7de', accent: '#0969da', onAccent: '#ffffff',
      danger: '#cf222e', success: '#1a7f37', warning: '#9a6700', info: '#0969da',
    },
    dark: {
      base: '#0d1117', mantle: '#010409', surface: '#161b22', surfaceAlt: '#21262d',
      fill: '#161b22', text: '#e6edf3', textMuted: '#8b949e', textFaint: '#6e7681',
      border: '#30363d', accent: '#58a6ff', onAccent: '#0d1117',
      danger: '#f85149', success: '#3fb950', warning: '#d29922', info: '#58a6ff',
    },
  },
]

/**
 * Preset ids alone, in picker order.
 *
 * The host half registers its settings schema synchronously, before any await,
 * so that the client's describe handshake sees the namespace during startup
 * (a late registration leaves the client scope stuck at `loading` forever).
 * Deriving the ids here keeps this module the single source of truth while
 * letting the host hold a small static list instead of the whole palettes.
 * @type {readonly string[]}
 */
export const PRESET_IDS = PRESETS.map(preset => preset.id)

/**
 * `color-mix` over the palette's own colors, so one palette serves both modes.
 * @param {string} color - base color.
 * @param {number} percent - opacity percentage.
 * @returns {string} a translucent color-mix value.
 */
function alpha(color, percent) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}

/**
 * Blend `color` over `base` at `percent` strength.
 * @param {string} color - foreground color.
 * @param {number} percent - blend percentage.
 * @param {string} base - background color.
 * @returns {string} a color-mix value.
 */
function over(color, percent, base) {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`
}

/**
 * Expand one mode's palette into the DSH alias-token surface.
 *
 * Derived tokens resolve against the palette rather than the base stylesheet,
 * so a preset needs no matching `--dsw-static-*` values and stays independent
 * of which base palette is active.
 * @param {Palette} p - the palette for the mode being styled.
 * @returns {Record<string, string>} every overridden alias token, keyed by custom-property name.
 */
export function deriveTokens(p) {
  const hairline = alpha(p.border, 55)
  const hover = alpha(p.text, 7)
  const active = alpha(p.text, 12)

  return {
    // ---- surfaces ----
    '--dsw-alias-bg-base': p.base,
    '--dsw-alias-bg-layer-1': p.surface,
    '--dsw-alias-bg-layer-2': p.surfaceAlt,
    '--dsw-alias-bg-layer-3': p.surfaceAlt,
    '--dsw-alias-bg-overlay': p.surfaceAlt,
    '--dsw-alias-bg-document-preview': p.mantle,
    '--dsw-alias-label-document-preview': p.textMuted,
    '--dsw-alias-bg-module-platform': p.fill,
    '--dsw-alias-bg-multi-select': p.fill,
    '--dsw-alias-bg-skeleton': alpha(p.text, 8),

    // ---- masks ----
    '--dsw-alias-bg-mask-1': 'rgba(0, 0, 0, 0.3)',
    '--dsw-alias-bg-mask-2': 'rgba(0, 0, 0, 0.14)',
    '--dsw-alias-bg-mask-3': 'rgba(0, 0, 0, 0.48)',
    '--dsw-alias-bg-mask-photo': 'rgba(0, 0, 0, 0.88)',
    '--dsw-alias-bg-mask-drop': alpha(p.base, 70),

    // ---- borders ----
    '--dsw-alias-border-l1': hairline,
    '--dsw-alias-border-l2': p.border,
    '--dsw-alias-border-l3': over(p.border, 72, p.text),
    '--dsw-alias-border-l4': over(p.border, 52, p.text),
    '--dsw-alias-border-l2-darkmode-thin': hairline,
    '--dsw-alias-border-inverted': alpha(p.text, 6),
    '--dsw-alias-border-inverted2': alpha(p.text, 8),

    // ---- labels ----
    '--dsw-alias-label-primary': p.text,
    '--dsw-alias-label-secondary': p.textMuted,
    '--dsw-alias-label-tertiary': p.textFaint,
    '--dsw-alias-label-caption': p.textFaint,
    '--dsw-alias-label-dimmed': alpha(p.text, 32),
    '--dsw-alias-label-primary-foreground': p.onAccent,
    '--dsw-alias-label-primary-inverted': p.base,
    '--dsw-alias-label-primary-dimmed': p.textMuted,
    '--dsw-alias-label-primary-bluish': p.text,

    // ---- brand, link, buttons ----
    '--dsw-alias-brand-primary': p.accent,
    '--dsw-alias-brand-text': p.accent,
    '--dsw-alias-brand-primary-invert': p.onAccent,
    '--dsw-alias-brand-primary-new-colorprimary-new-color': p.accent,
    '--dsw-alias-link': p.info,
    '--dsw-alias-button-info-fill': p.info,
    '--dsw-alias-button-info-hover': over(p.info, 82, p.text),
    '--dsw-alias-button-primary-fill': p.accent,
    '--dsw-alias-button-primary-hover': over(p.accent, 82, p.text),
    '--dsw-alias-button-primary-dimmed': alpha(p.accent, 22),
    '--dsw-alias-button-contrast-fill': p.text,
    '--dsw-alias-button-elevated-fill': p.surface,
    '--dsw-alias-button-floating-fill': p.surfaceAlt,
    '--dsw-alias-button-floating-hover': over(p.surfaceAlt, 78, p.text),
    '--dsw-alias-button-ghost-active-fill': p.fill,
    '--dsw-alias-button-ghost-active-hover': over(p.fill, 78, p.text),
    '--dsw-alias-button-ghost-active-border': p.border,
    '--dsw-alias-button-tool-bar-fill-invisible': 'rgba(31, 31, 31, 0.36)',
    '--dsw-alias-button-tool-bar-fill': 'rgba(84, 85, 87, 0.5)',
    '--dsw-alias-button-tool-bar-hover': 'rgba(84, 85, 87, 0.6)',

    // ---- interactive ----
    '--dsw-alias-interactive-bg-hover': hover,
    '--dsw-alias-interactive-bg-active': active,
    '--dsw-alias-interactive-bg-hover-accent': alpha(p.accent, 14),
    '--dsw-alias-interactive-bg-hover-danger': alpha(p.danger, 12),
    '--dsw-alias-interactive-bg-hover-solid': p.surfaceAlt,

    // ---- states ----
    '--dsw-alias-state-error-primary': p.danger,
    '--dsw-alias-state-error-secondary': over(p.danger, 80, p.text),
    '--dsw-alias-state-success-primary': p.success,
    '--dsw-alias-state-success-secondary': over(p.success, 80, p.text),
    '--dsw-alias-state-success-tertiary': alpha(p.success, 16),
    '--dsw-alias-state-warn-primary': p.warning,
    '--dsw-alias-state-warn-secondary': over(p.warning, 80, p.text),
    '--dsw-alias-state-warn-label': over(p.warning, 82, p.text),
    '--dsw-alias-state-warn-tertiary': alpha(p.warning, 16),
    '--dsw-alias-state-business-primary': p.info,
    '--dsw-alias-state-business-tertiary': alpha(p.info, 16),

    // ---- markdown ----
    '--dsw-alias-markdown-code-block': p.fill,
    '--dsw-alias-markdown-code-block-banner': over(p.fill, 70, p.base),
    '--dsw-alias-markdown-inline-code': p.fill,
    '--dsw-alias-markdown-citation': alpha(p.text, 12),
    '--dsw-alias-markdown-tag': p.fill,
    '--dsw-alias-markdown-placeholder': alpha(p.text, 26),
    '--dsw-alias-markdown-code-segment-selected': p.surface,
    '--dsw-alias-markdown-code-segment-unselected': p.fill,

    // ---- scrollbars ----
    '--dsw-alias-scrollbar-bg-l1': over(p.border, 62, p.text),
    '--dsw-alias-scrollbar-bg-l2': over(p.border, 62, p.text),
    '--dsw-alias-scrollbar-hover-l1': over(p.border, 84, p.text),
    '--dsw-alias-scrollbar-hover-l2': over(p.border, 84, p.text),

    // ---- floating chrome ----
    '--dsw-alias-toast-bg': p.surfaceAlt,
    '--dsw-alias-tooltip-bg': p.surfaceAlt,

    // ---- product-specific surfaces ----
    '--dsw-specific-sidebar-fill': p.mantle,
    '--dsw-specific-sidebar-nav-item-hover': hover,
    '--dsw-specific-sidebar-nav-item-active': p.fill,
    '--dsw-specific-sidebar-nav-item-active-accent': alpha(p.accent, 18),
    '--dsw-specific-bubble': p.fill,
    '--dsw-specific-bubble-highlight': alpha(p.accent, 16),
    '--dsw-specific-input-major': p.surface,
    '--dsw-specific-login-input': p.fill,
    '--dsw-specific-menu': p.surfaceAlt,
    '--dsw-specific-selector': p.fill,
    '--dsw-specific-tip': p.fill,
  }
}

/**
 * Build one preset's override layer in ui-theme's `overrideTokens` shape: every
 * token carries the value for each mode, and ui-theme picks by the active
 * color scheme. This is what makes a preset orthogonal to light/dark/system.
 * @param {string} id - preset id; an unknown or `default` id yields an empty layer.
 * @returns {Record<string, { light: string, dark: string }>} token-name → per-mode pairs.
 */
export function presetOverrides(id) {
  const preset = PRESETS.find(candidate => candidate.id === id)
  if (preset === undefined) return {}
  const light = deriveTokens(preset.light)
  const dark = deriveTokens(preset.dark)
  return Object.fromEntries(
    Object.keys(light).map(name => [name, { light: light[name], dark: dark[name] }]),
  )
}

/**
 * One mode's tokens as plain CSS declarations, used by the host-side boot
 * injection which must style the first paint before any script runs.
 * @param {string} id - preset id.
 * @param {'light'|'dark'} scheme - resolved color scheme to emit.
 * @returns {string} CSS declarations, or an empty string for `default`.
 */
export function presetCss(id, scheme) {
  const preset = PRESETS.find(candidate => candidate.id === id)
  if (preset === undefined) return ''
  const tokens = deriveTokens(scheme === 'dark' ? preset.dark : preset.light)
  return Object.entries(tokens).map(([name, value]) => `${name}:${value}`).join(';')
}
