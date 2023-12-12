import { globby } from 'globby'
import { readFile, readdir, mkdir, open } from 'fs/promises'
import { join } from 'path'
import { CACHE_PATH } from './constants.js'
import hashit from './hashit.js'
import { rollup } from 'rollup'
import { execSync, spawn, spawnSync } from 'child_process'

const orderedList = ['messages', 'addresses', 'lib']
const root = 'packages'

const build = async (root, project) =>
  new Promise((resolve) => {
    try {
      const spawnee = spawn(`npm run build`, { cwd: join(process.cwd(), root, project), shell: true })
      spawnee.stdout.on('data', (data) => {
        console.log(data.toString())
      })

      spawnee.stderr.on('data', (data) => {
        if (data.toString().includes('created')) {
        }
      })
      spawnee.stderr.on('close', () => resolve())
    } catch (error) {
      console.log(error.message)
      if (error.message.includes('Missing script: "build"')) {
        console.warn(`no npm run build command present for ${project}`)
      }
    }
  })

const transformWorkspaceDir = async (root) =>
  await Promise.all(
    (await readdir(root)).map(async (project) => {
      let files = []
      try {
        files = await globby([`${root}/${project}/src/**`])
      } catch (error) {
        console.warn(`no files found, make sure all source files are in ${join(root, project, 'src')}`)
      }
      return { root, project, files }
    })
  )

try {
  const fd = await open(CACHE_PATH)
  await fd.close()
} catch (error) {
  await mkdir(CACHE_PATH)
}

const projectDirs = await transformWorkspaceDir(root)
const promises = []

const projects = []

for (const project of [...projectDirs]) {
  if (orderedList.includes(project.project)) {
    projectDirs.slice(projectDirs.indexOf(project), '1')
    projects.push(project)
  }
}

try {
  for (const project of [...projects, ...projectDirs]) {
    try {
      const result = await hashit(project)
      if (result && result.changed === true) {
        if (orderedList.includes(result.project)) await build(root, result.project)
        else promises.push(build(root, result.project))
      }
    } catch (error) {
      if (error.message.includes('Missing script: "build"')) {
        console.warn(`no npm run build command present for ${project}`)
      }
      console.log(error.message)
      console.error(error)
    }
  }
  await Promise.all(promises)
} catch (error) {
  console.log(error.message)
  if (error.message.includes('Missing script: "build"')) {
    console.warn(`no npm run build command present for ${project}`)
  }
  console.error(error)
}
// const result = await Promise.all(promises)
// console.log(result)
