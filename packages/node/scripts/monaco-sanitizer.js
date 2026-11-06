import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const normalize = path => path.replaceAll('\\', '/')
const sanitizerImporter = '/monaco-editor/esm/vs/base/browser/domSanitize.js'
const vendoredSanitizer = '/monaco-editor/esm/vs/base/browser/dompurify/dompurify.js'

export function assertPatchedMonacoModules(moduleIds, patchedEntry) {
  const modules = moduleIds.map(normalize)
  assert.ok(modules.includes(normalize(patchedEntry)), 'Monaco must bundle the patched npm DOMPurify module')
  assert.ok(!modules.some(id => id.endsWith(vendoredSanitizer)), 'Monaco must not bundle its obsolete vendored DOMPurify copy')
}

// Monaco 0.55.x imports its vendored copy instead of its declared npm dependency.
// Replace only this import; do not upgrade or modify the editor itself.
export function patchedMonacoSanitizer() {
  const patchedEntry = fileURLToPath(import.meta.resolve('dompurify'))
  return {
    name: 'patched-monaco-sanitizer',
    resolveId(source, importer) {
      if (source === './dompurify/dompurify.js' && importer && normalize(importer).endsWith(sanitizerImporter))
        return patchedEntry
      return null
    },
    generateBundle(_options, bundle) {
      const modules = Object.values(bundle).filter(output => output.type === 'chunk')
        .flatMap(chunk => Object.keys(chunk.modules))
      assertPatchedMonacoModules(modules, patchedEntry)
    }
  }
}
