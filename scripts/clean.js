import { unlink } from 'fs/promises'
import { globby } from 'globby'
import inquirer from 'inquirer'

const choices = [
  {
    name: '**/node_modules/**',
    checked: true
  },
  {
    name: '**/exports/**',
    checked: true
  }
]

let { dirs } = await inquirer.prompt([
  {
    type: 'checkbox',
    name: 'dirs',
    message: 'Select the directories to clean',
    choices
  }
])

dirs = await Promise.all(dirs.map(async (dir) => await globby([dir, '!node_modules'])))

for (const files of dirs) {
  for (const file of files) await unlink(file)
}
