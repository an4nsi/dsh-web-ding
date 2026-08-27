import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import { transform } from 'lightningcss'
import { defineConfig } from 'tsdown'

// Must match package.json "name". The client bundle registers itself with this
// id via window.__ModuleLoader__.load, and the client-modules boot graph keys on
// the package name — so this id and the package name must stay in sync.
const ID = 'dsh-web-ding'


// Port of the framework preset's dsh-css-modules-inline plugin
// (packages/client/tsdown.client.ts): *.module.css compiles via lightningcss
// into a hashed class map whose styles inject a <style data-plugin-css> tag at
// factory execution.
const CSS_PREFIX = '\0dsh-css:'
const CSS_SUFFIX = '.mjs'
function dshCssModules(id: string) {
  return {
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer?: string) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
      // Keep the virtual module id workspace-relative: it is embedded in the built
      // client.js (//#region comments), and an absolute checkout path would leak
      // the build machine's layout into the public repo.
      const rel = abs.startsWith(process.cwd() + '/') ? abs.slice(process.cwd().length + 1) : abs
      return CSS_PREFIX + rel + CSS_SUFFIX
    },
    async load(this: { addWatchFile(fileId: string): void }, virtualId: string) {
      if (!virtualId.startsWith(CSS_PREFIX)) return null
      const fileId = virtualId.slice(CSS_PREFIX.length, -CSS_SUFFIX.length)
      this.addWatchFile(fileId)
      const src = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: src,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(`${id}/${basename(fileId)}`)};`,
        `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
        `  const tag = document.createElement('style');`,
        `  tag.dataset.pluginCss = tagId;`,
        `  tag.textContent = css;`,
        `  document.head.appendChild(tag);`,
        `}`,
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }
}

// Modules the web shell provides through the frozen loader module table; every
// other import is inlined into the browser bundle. (Mirror of the official
// packages/client/tsdown.client.ts preset; we only externalize what we touch.)
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
]

export default defineConfig([
  // Host / node half -> lib/index.js (cordis Loader mounts the empty apply()).
  {
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
    outputOptions: { entryFileNames: 'index.js' },
  },
  // Browser client bundle -> lib/client.js. CJS closure factory stamped with the
  // __ModuleLoader__.load handoff, exactly like the framework's client-bundle preset.
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    sourcemap: true,
    dts: false,
    deps: {
      // Inline everything that is not a platform module (we have no other runtime deps).
      alwaysBundle: () => true,
      neverBundle: CLIENT_EXTERNALS,
    },
    plugins: [dshCssModules(ID)],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
