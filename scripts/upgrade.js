import {rimraf} from 'rimraf'
import { globby } from 'globby'
import { execSync } from 'child_process'

for (const file of await globby(['**/**/package-lock.json', '!**/**/node_modules/**/package-lock.json'])) {
  console.log(file);
  rimraf.sync(file)
}

execSync('npm i')
