import { parse } from 'acorn'

export const prepareGenesisContractSource = (input) => {
  const source = String(input)
  const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
  const exports = program.body.filter(
    (node) => node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration'
  )
  let defaultBinding

  for (const node of exports) {
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type !== 'Identifier' && !node.declaration.id?.name) {
        throw new Error('genesis contract default export must have a stable class binding')
      }
      defaultBinding = node.declaration.name ?? node.declaration.id.name
      continue
    }
    const defaultSpecifier = node.specifiers.find((specifier) => specifier.exported.name === 'default')
    if (defaultSpecifier) defaultBinding = defaultSpecifier.local.name
  }

  if (!defaultBinding) throw new Error('genesis contract bundle has no default export')

  let executable = source
  for (const node of exports.sort((left, right) => right.start - left.start)) {
    const replacement = node.type === 'ExportDefaultDeclaration' ? source.slice(node.declaration.start, node.declaration.end) : ''
    executable = `${executable.slice(0, node.start)}${replacement}${executable.slice(node.end)}`
  }
  return `${executable}\nreturn ${defaultBinding}`
}
