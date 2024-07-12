import { spawnSync } from 'node:child_process'

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
      if (error.message.includes('Missing script: "build"')) {
        console.warn(`no npm run build command present for ${project}`)
      } else {
        console.log(error.message)
      }
    }
  })
