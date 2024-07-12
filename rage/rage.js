#!/usr/bin/env node
import { readFile, readdir, mkdir, open, stat } from 'fs/promises'
import { join, parse } from 'path'
import { CACHE_PATH } from './constants.js'
import hashit from './hashit.js'
import { glob } from 'fs/promises'
import { spawnSync } from 'child_process'
import Listr from 'listr'
import os from 'os'
import { parseArgs } from 'node:util'

const availableCpuCores = os.cpus().length

const options = {
  config: {
    type: 'string',
    short: 'c'
  },
  build: {
    type: 'boolean',
    short: 'b'
  },
  release: {
    type: 'boolean',
    short: 'r'
  }
}

const { values } = parseArgs({ options })

const config = values.config
  ? (await import(join(process.cwd(), values.config))).default
  : (await import(join(process.cwd(), 'rage.config.js'))).default

console.log({ config })

const priority = config.priority
const root = config.root

const build = async (root, project) =>
  new Promise((resolve) => {
    try {
      const spawnee = spawnSync(`npm run build`, { cwd: join(process.cwd(), root, project), shell: true })
      // todo better error handling
      if (process.argv.includes('--log')) {
        const stderr = spawnee.stderr.toString()
        if (stderr.includes('ERR') || stderr.includes('error')) console.warn(stderr)
      }
      resolve()
    } catch (error) {
      console.log(error.message)
      if (error.message.includes('Missing script: "build"')) {
        console.warn(`no npm run build command present for ${project}`)
      }
    }
  })

const transformWorkspaceDir = async (root) =>
  await Promise.all(
    (
      await readdir(root)
    ).map(async (project) => {
      let files = []
      try {
        const _files = await glob([`${root}/${project}/src/**`])
        for await (const file of _files) {
          const stats = await stat(file)
          if (stats.isFile()) files.push(file)
        }
      } catch (error) {
        console.warn(`no files found, make sure all source files are in ${join(root, project, 'src')}`)
      }
      return { root, project, files }
    })
  )

const checkCache = async () => {
  try {
    const fd = await open(CACHE_PATH)
    await fd.close()
  } catch (error) {
    await mkdir(CACHE_PATH)
  }
}
let projectDirs

const priorityProjects = []

const nonPriorityProjects = []

const sortProjects = () => {
  for (const project of [...projectDirs]) {
    if (priority.includes(project.project)) {
      projectDirs.slice(projectDirs.indexOf(project), '1')
      priorityProjects.push(project)
    } else {
      nonPriorityProjects.push(project)
    }
  }
}

const buildPriority = async () => {
  const results = await Promise.all(priorityProjects.map((project) => hashit(project)))
  for (const result of results) {
    if (result) {
      if (result.changed || process.argv.includes('--all'))
        if (priority.includes(result.project)) await build(root, result.project)
    }
  }
}

const buildNonPriority = async () => {
  const results = await Promise.all(nonPriorityProjects.map((project) => hashit(project)))
  let promises = []
  let count = 0
  try {
    for (const result of results) {
      if (result) {
        if (count === availableCpuCores) {
          await Promise.all(promises)
          promises = []
          count = 0
        }
        if (result.changed || process.argv.includes('--all')) {
          promises.push(build(root, result.project))
        }
        count += 1
      }
    }

    if (promises.length > 0) await Promise.all(promises)
  } catch (error) {
    console.log(error.message)
    if (error.message.includes('Missing script: "build"')) {
      console.warn(`no npm run build command present for ${project}`)
    }
    throw error
  }
}

// const result = await Promise.all(promises)
// console.log(result)
const tasks = new Listr([
  {
    title: 'Check requirements',
    task: () =>
      new Listr([
        {
          title: 'cache',
          task: () => checkCache()
        }
      ])
  },
  {
    title: 'Get projects',
    task: () =>
      new Listr([
        {
          title: 'getting projects',
          task: async () => (projectDirs = await transformWorkspaceDir(root))
        }
      ])
  },
  {
    title: 'Build projects',
    task: () =>
      new Listr([
        { title: 'sorting projects', task: () => sortProjects() },
        { title: 'building priority projects', task: () => buildPriority() },
        {
          title: 'building non priority projects',
          task: () => buildNonPriority()
        }
      ])
  }
])

// await checkCache()
// projectDirs = await transformWorkspaceDir(root)
// await sortProjects()
// await buildPriority()
// await buildNonPriority()
tasks.run().catch((err) => {
  console.error(err)
})
