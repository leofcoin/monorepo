import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

test('dependency declarations preserve codec return types and resolve wallet and base58 types', () => {
  const fixture = fileURLToPath(new URL('../fixtures/dependency-types.ts', import.meta.url))
  const program = ts.createProgram([fixture], {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: ['node']
  })
  const errors = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(errors.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), [])
})
