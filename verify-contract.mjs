#!/usr/bin/env node
/**
 * verify-contract.mjs — check that this plugin satisfies the dsh `client-modules`
 * discovery contract *outside* a running dsh process.
 *
 * It mirrors two upstream sources, so a failure here means the plugin would not
 * be discovered by a real composition:
 *   - packages/client/modules/src/index.ts (`locatePkgJson`, `nearestPackage`, `clientExportOf`,
 *     and the `platform !== 'web'` / missing-bundle verdicts in `resolveMeta`)
 *   - packages/client/modules/src/client/manifest.ts (`parseDshClient`, `exactPackageSpecifier`)
 *
 * Run: node verify-contract.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** The loader row `name` the profile mounts for local development. */
const ROW_NAME = join(here, 'host.js')

const failures = []
const notes = []

/** Record one check outcome. */
function check(ok, label, detail = '') {
  if (ok) notes.push(`  ok   ${label}${detail === '' ? '' : ` — ${detail}`}`)
  else failures.push(`  FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

// --- exactPackageSpecifier (manifest.ts) -------------------------------------
/** A bare package-root specifier, or undefined for a path/subpath/scheme. */
function exactPackageSpecifier(specifier) {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/')
    return parts.length === 2 && parts.every(Boolean) ? specifier : undefined
  }
  return specifier.length > 0 && !specifier.includes('/') && !specifier.includes(':')
    ? specifier
    : undefined
}

// --- parseDshClient (manifest.ts) --------------------------------------------
function optionalStringArray(pkgName, field, value) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) {
    throw new Error(`client-modules: ${pkgName} ${field} must be an array of strings`)
  }
  return value
}

/** Validate and normalize one package's `dsh.client` declaration. */
function parseDshClient(pkgName, value) {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null) {
    throw new Error(`client-modules: ${pkgName} has a non-object dsh.client declaration`)
  }
  const decl = value
  if (typeof decl.platform !== 'string') {
    throw new Error(`client-modules: ${pkgName} dsh.client.platform must be a string`)
  }
  const inject = optionalStringArray(pkgName, 'dsh.client.inject', decl.inject)
  const external = optionalStringArray(pkgName, 'dsh.client.external', decl.external)
  if (decl.immediately !== undefined && typeof decl.immediately !== 'boolean') {
    throw new Error(`client-modules: ${pkgName} dsh.client.immediately must be a boolean`)
  }
  return {
    platform: decl.platform,
    ...(inject !== undefined ? { inject } : {}),
    ...(external !== undefined ? { external } : {}),
  }
}

// --- nearestPackage (index.ts) ------------------------------------------------
/** Walk up from a module file to the nearest manifest owning it. */
function nearestPackage(modulePath, expectedPackageName) {
  let dir = dirname(modulePath)
  for (;;) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      try {
        const name = JSON.parse(readFileSync(candidate, 'utf8')).name
        if (typeof name === 'string' && (expectedPackageName === undefined || name === expectedPackageName)) {
          return { path: candidate, packageName: name }
        }
      } catch {
        // keep walking
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

// --- clientExportOf (index.ts) -----------------------------------------------
function clientExportOf(pkgName, exportsField) {
  if (typeof exportsField !== 'object' || exportsField === null) return undefined
  const client = exportsField['./client']
  if (client === undefined) return undefined
  if (typeof client === 'string') return client
  if (typeof client === 'object' && client !== null) {
    const fallback = client.default
    if (typeof fallback === 'string') return fallback
  }
  throw new Error(`client-modules: ${pkgName} exports["./client"] must be a string or an object with a string default`)
}

// --- the real discovery chain -------------------------------------------------
const pathLike = ROW_NAME.startsWith('.') || ROW_NAME.startsWith('file:') || resolve(ROW_NAME) === ROW_NAME
const expectedPackageName = pathLike ? undefined : exactPackageSpecifier(ROW_NAME)
check(pathLike || expectedPackageName !== undefined, 'row name is resolvable', ROW_NAME)

const located = nearestPackage(ROW_NAME, expectedPackageName)
check(located !== undefined, 'nearest package.json found', located?.path ?? 'none')

if (located === undefined) {
  report()
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(located.path, 'utf8'))
const decl = parseDshClient(located.packageName, pkg.dsh?.client)
check(decl !== undefined, 'dsh.client declared')
check(decl?.platform === 'web', 'dsh.client.platform is "web"', String(decl?.platform))

const clientRel = clientExportOf(located.packageName, pkg.exports)
check(clientRel !== undefined, 'exports["./client"] resolves', String(clientRel))

const clientPath = join(dirname(located.path), clientRel)
check(existsSync(clientPath), 'client bundle exists on disk', clientPath)

if (existsSync(clientPath)) {
  const bundle = readFileSync(clientPath, 'utf8')
  check(bundle.includes('__ModuleLoader__.load('), 'bundle registers with window.__ModuleLoader__.load')
  check(bundle.includes(`id: "${located.packageName}"`),
    'bundle id equals the package name (the graph table key)', located.packageName)
  check(!/^\s*(import|export)\s/m.test(bundle),
    'bundle is a plain script (no ESM import/export that would break load())')
}

// --- declared client-plugin prerequisites ------------------------------------
const roster = new Set([
  '@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-theme', '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-store',
])
for (const dep of decl?.inject ?? []) {
  check(roster.has(dep), `declared inject is a known client plugin`, dep)
}

// --- bundle install contract --------------------------------------------------
// Installing through the GUI adds this package to a profile and mounts its host
// rows from `dsh.bundle.patch`. A package without that declaration is taken as a
// plain dependency ("declares no dsh.bundle — installed as a plain dependency,
// not a profile layer"), so the host half never loads — while the client half
// still is discovered from `dsh.client`. The result is quietly broken: the
// settings row renders and clicks land, but the pre-paint injection does nothing
// and the durable write has no namespace to reach.
{
  const own = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))

  check(exactPackageSpecifier(own.name) === own.name,
    'package name is a bare specifier the installer accepts', String(own.name))

  const bundlePatch = own.dsh?.bundle?.patch
  check(typeof bundlePatch === 'string' && bundlePatch !== '',
    'dsh.bundle.patch is declared, so the host half is mounted on install', String(bundlePatch))

  if (typeof bundlePatch === 'string' && bundlePatch !== '') {
    // `files[]` entries are matched without a leading `./`, while the declared
    // patch path conventionally carries one; compare them normalized.
    const normalize = (entry) => entry.replace(/^\.\//, '')
    check((own.files ?? []).map(normalize).includes(normalize(bundlePatch)),
      'files[] ships the bundle patch (an npm publish would omit it otherwise)', bundlePatch)

    const patchPath = join(here, bundlePatch)
    check(existsSync(patchPath), 'the declared bundle patch exists on disk', patchPath)

    if (existsSync(patchPath)) {
      const patch = readFileSync(patchPath, 'utf8')
      check(patch.includes('- insert:'), 'the bundle patch contributes a row')
      check(new RegExp(`name:\\s*['"]${own.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(patch),
        'the bundle patch mounts this package by its own name', String(own.name))
      // A path here would only ever resolve on the machine that wrote it.
      const rowNames = [...patch.matchAll(/name:\s*(['"]?)([^'"\n]+)\1/g)].map(match => match[2].trim())
      check(rowNames.length > 0 && rowNames.every(name => exactPackageSpecifier(name) !== undefined),
        'every row name is a package specifier, not a machine-specific path', rowNames.join(', '))
    }
  }
}

/** Print the collected results and set the exit status. */
function report() {
  console.log(`contract check for ${located?.packageName ?? ROW_NAME}`)
  for (const line of notes) console.log(line)
  for (const line of failures) console.log(line)
  console.log(failures.length === 0
    ? `\nPASS — ${notes.length} checks`
    : `\nFAIL — ${failures.length} of ${notes.length + failures.length} checks`)
}

report()
process.exit(failures.length === 0 ? 0 : 1)
