import { readFile } from 'fs'
import { join } from 'path'

export default (path) => {
  console.log(path);
  return readFile(join('node_modules', path), ((error, data) => {
    console.log(error);
    console.log(data);
    return {contents: data.toString()}
  }))
}
