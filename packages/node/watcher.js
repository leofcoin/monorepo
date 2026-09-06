import { rollup, watch } from 'rollup'
import config from './rollup.dev.config.js'
import chokidar from 'chokidar'
import posix from 'path/posix'
import { sep } from 'path'
let cache

async function buildWithCache({ input, plugins, external, output }) {
  const bundle = await rollup({
    cache,
    input,
    plugins,
    external
  })
  cache = bundle.cache // store the cache object of the previous build
  // await bundle.generate(output)
  await bundle.write(output)
  return bundle
}

for (const build of config) {
  console.log('building')
  console.time('build')

  const bundle = await buildWithCache(build)
  const watcher = await chokidar.watch(bundle.watchFiles, { cwd: process.cwd() })

  let timeout

  watcher.on('change', async (file) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(async () => {
      console.log('file changed ' + file)
      console.time('buildtime')
      const watchedFiles = watcher.getWatched()
      const bundle = await buildWithCache(build)

      for (const file of Object.keys(watchedFiles)) {
        if (!bundle.watchFiles.includes(file)) {
          watcher.unwatch([file])
        }
      }
      for (const file of bundle.watchFiles) {
        if (!watchedFiles[file]) {
          watcher.add(file)
        }
      }
      console.timeEnd('buildtime')
    }, 100)
  })
  console.timeEnd('build')
}
