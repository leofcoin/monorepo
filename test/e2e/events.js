import { createInterface } from 'node:readline'

export const readEvents = (stream, onEvent) => {
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  lines.on('line', line => {
    if (line.startsWith('E2E_EVENT:')) onEvent(JSON.parse(line.slice(10)))
  })
  return lines
}
