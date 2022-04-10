// import { promisify } from 'util'
// import { writeFile, readFile } from 'fs'
export { BigNumber } from "@ethersproject/bignumber";
export { formatUnits, parseUnits } from '@ethersproject/units'
import chalk from 'chalk'

const info = text => console.log(chalk.blueBright(text))

const subinfo = text => console.log(chalk.magentaBright(text))

export {
  info,
  subinfo
}
// export const write = promisify(writeFile)
// export const read = promisify(readFile)
