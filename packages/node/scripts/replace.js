import { readFile, readdir, writeFile } from "fs/promises";
import { join, parse } from 'path'
const files = await readdir('src', {recursive: true})
const replace = async (path) => {
  path = join('src', path)
  const isDir = !parse(path).ext
  if (!isDir) {
    let data = (await readFile(path)).toString()
    data = data.replace(/lit-element/g, 'lite-element')
    await writeFile(path, data)
  }

}


await Promise.all(
  files
    .map(file => replace(file))
)