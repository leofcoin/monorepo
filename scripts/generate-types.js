import { glob } from 'fs/promises'

const entries = await glob('packages/*/exports/**/*.d.ts')

for await (const entry of entries) console.log(entry)
