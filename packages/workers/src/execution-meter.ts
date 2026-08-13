import { parse } from 'acorn'

export const DEFAULT_CONTRACT_EXECUTION_UNITS = 100_000

const FORBIDDEN_GLOBALS = new Set([
  'Atomics',
  'Function',
  'SharedArrayBuffer',
  'WebSocket',
  'Worker',
  'XMLHttpRequest',
  'eval',
  'fetch',
  'global',
  'globalThis',
  'performance',
  'process',
  'require',
  'self',
  'window'
])

const FUNCTION_TYPES = new Set(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'])

const LOOP_TYPES = new Set(['DoWhileStatement', 'ForInStatement', 'ForOfStatement', 'ForStatement', 'WhileStatement'])

export class ContractExecutionLimitError extends Error {
  code = 'CONTRACT_EXECUTION_LIMIT'

  constructor(limit: number) {
    super(`contract execution exceeded deterministic limit of ${limit} units`)
    this.name = 'ContractExecutionLimitError'
  }
}

export class ContractDeterminismError extends Error {
  code = 'CONTRACT_NON_DETERMINISTIC_SOURCE'

  constructor(globalName: string) {
    super(`contract source uses forbidden non-deterministic global: ${globalName}`)
    this.name = 'ContractDeterminismError'
  }
}

export class ExecutionMeter {
  readonly limit: number
  used = 0

  constructor(limit = DEFAULT_CONTRACT_EXECUTION_UNITS) {
    if (!Number.isSafeInteger(limit) || limit <= 0)
      throw new TypeError('execution limit must be a positive safe integer')
    this.limit = limit
  }

  tick(units = 1) {
    if (!Number.isSafeInteger(units) || units <= 0)
      throw new TypeError('execution units must be a positive safe integer')
    this.used += units
    if (this.used > this.limit) throw new ContractExecutionLimitError(this.limit)
  }
}

type Edit = { end: number; start: number; text: string }

const isPropertyName = (node, parent) =>
  (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
  (parent?.type === 'Property' && parent.key === node && !parent.computed) ||
  (parent?.type === 'MethodDefinition' && parent.key === node && !parent.computed)

const walk = (node, parent, visit) => {
  if (!node || typeof node.type !== 'string') return
  visit(node, parent)
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end' || key === 'type') continue
    if (Array.isArray(value)) {
      for (const child of value) walk(child, node, visit)
    } else if (value && typeof value === 'object') {
      walk(value, node, visit)
    }
  }
}

const blockEntry = (block) => {
  const directives = block.body?.filter((statement) => statement.type === 'ExpressionStatement' && statement.directive)
  return directives?.length ? directives[directives.length - 1].end : block.start + 1
}

/**
 * Adds deterministic checkpoints without changing the contract wire format.
 * The exact transformation is protocol code and must remain identical on every node.
 */
export const instrumentContractSource = (source: string): string => {
  const ast: any = parse(source, {
    allowAwaitOutsideFunction: false,
    allowReturnOutsideFunction: true,
    ecmaVersion: 'latest',
    sourceType: 'script'
  })
  const edits: Edit[] = [{ start: 0, end: 0, text: '__lfcMeter.tick();' }]

  walk(ast, undefined, (node, parent) => {
    if (node.type === 'Identifier' && node.name === 'Date' && !isPropertyName(node, parent)) {
      const isDeterministicNow =
        parent?.type === 'MemberExpression' &&
        parent.object === node &&
        !parent.computed &&
        parent.property?.name === 'now'
      if (!isDeterministicNow) throw new ContractDeterminismError('Date (only Date.now() is supported)')
    }
    if (node.type === 'Identifier' && FORBIDDEN_GLOBALS.has(node.name) && !isPropertyName(node, parent)) {
      throw new ContractDeterminismError(node.name)
    }
    if (node.type === 'Identifier' && node.name === 'crypto' && !isPropertyName(node, parent)) {
      const member = parent?.type === 'MemberExpression' && parent.object === node && !parent.computed
      const supported = member && ['getRandomValues', 'randomUUID'].includes(parent.property?.name)
      if (!supported) {
        throw new ContractDeterminismError('crypto (only getRandomValues() and randomUUID() are supported)')
      }
    }
    if (
      node.type === 'MemberExpression' &&
      node.object?.type === 'Identifier' &&
      node.object.name === 'Math' &&
      !node.computed &&
      node.property?.name === 'random'
    ) {
      throw new ContractDeterminismError('Math.random')
    }
    if (FUNCTION_TYPES.has(node.type)) {
      if (node.body.type === 'BlockStatement') {
        edits.push({ start: blockEntry(node.body), end: blockEntry(node.body), text: '__lfcMeter.tick();' })
      } else {
        edits.push({ start: node.body.start, end: node.body.start, text: '(__lfcMeter.tick(),' })
        edits.push({ start: node.body.end, end: node.body.end, text: ')' })
      }
    }

    if (LOOP_TYPES.has(node.type)) {
      if (node.body.type === 'BlockStatement') {
        const position = blockEntry(node.body)
        edits.push({ start: position, end: position, text: '__lfcMeter.tick();' })
      } else {
        edits.push({ start: node.body.start, end: node.body.start, text: '{__lfcMeter.tick();' })
        edits.push({ start: node.body.end, end: node.body.end, text: '}' })
      }
    }
  })

  edits.sort((left, right) => right.start - left.start || right.end - left.end)
  let output = source
  for (const edit of edits) output = output.slice(0, edit.start) + edit.text + output.slice(edit.end)
  return output
}
