import promisify from 'util'
import { writeFile, readFile } from 'fs'

export const write = promisify(writeFile)
export const read = promisify(readFile)
