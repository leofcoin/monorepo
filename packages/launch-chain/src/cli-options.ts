export type CliCommand = 'node' | 'validator' | 'account' | 'balance' | 'status' | 'transfer' | 'help' | 'version'

export type CliOptions = {
  command: CliCommand
  positionals: string[]
  network?: string
  root?: string
  passwordFile?: string
  intervalMinutes?: number
  httpPort: number | false
  wsPort: number | false
  shell: boolean
  stars?: string[]
}

const commands = new Set<CliCommand>(['node', 'validator', 'account', 'balance', 'status', 'transfer', 'help', 'version'])

const port = (name: string, value: string): number => {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65_535) throw new Error(`${name} must be a valid port`)
  return parsed
}

export const parseCliOptions = (args: string[]): CliOptions => {
  let command: CliCommand | undefined
  const positionals: string[] = []
  const stars: string[] = []
  const options: CliOptions = { command: 'help', positionals, httpPort: 8080, wsPort: 4040, shell: true }
  const value = (index: number, name: string) => {
    const result = args[index + 1]
    if (!result || result.startsWith('-')) throw new Error(`${name} requires a value`)
    return result
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '-h' || argument === '--help') command = 'help'
    else if (argument === '-v' || argument === '--version') command = 'version'
    else if (argument === '--network') options.network = value(index++, argument)
    else if (argument === '--root') options.root = value(index++, argument)
    else if (argument === '--password-file') options.passwordFile = value(index++, argument)
    else if (argument === '--interval') {
      options.intervalMinutes = Number(value(index++, argument))
      if (!Number.isFinite(options.intervalMinutes) || options.intervalMinutes < 1) throw new Error('--interval must be at least one minute')
    } else if (argument === '--http-port') options.httpPort = port(argument, value(index++, argument))
    else if (argument === '--ws-port') options.wsPort = port(argument, value(index++, argument))
    else if (argument === '--no-endpoints') { options.httpPort = false; options.wsPort = false }
    else if (argument === '--no-shell') options.shell = false
    else if (argument === '--star') stars.push(value(index++, argument))
    else if (argument === '--no-stars') options.stars = []
    else if (argument.startsWith('-')) throw new Error(`unknown option: ${argument}`)
    else if (!command) {
      if (!commands.has(argument as CliCommand)) throw new Error(`unknown command: ${argument}`)
      command = argument as CliCommand
    } else positionals.push(argument)
  }

  options.command = command ?? 'help'
  if (stars.length > 0) options.stars = stars
  return options
}
