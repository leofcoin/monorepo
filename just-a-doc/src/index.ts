
import * as events from 'node:events'
import * as fs from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, parse } from 'node:path'
import * as readline from 'node:readline'
import {globby} from 'globby'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const safeExec = promisify(execFile)

interface param {
  name: string,
  value: string,
  description: string,
  type: string
}
interface example {
  name: string,
  value: string
}

interface link {
  name: string,
  url: string
}

interface code {
  value: string,
  lines?: []
}

type params = param[]
type examples = example[]
type links = link[]

interface token {
  name: string,
  type: string,
  description: string,
  code: code,
  start: Number,
  end: Number,
  params: params,
  examples: examples,
  links: links,
  lines?: string[],
  value: string,
  private: boolean,
  return: {}
}

const readLines = async (input: string): Promise<{ tokens: token[], lines: token[]}> => {
  const tokens = new Array()
  const lines = new Array()
  let lineIndex = 0
  let value = ''
  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(input),
      crlfDelay: Infinity
    });
    let open = false
    let start
    rl.on('line', (line) => {
      lines.push(line)
      lineIndex += 1
      if (open) value += `${line.trim()}\n`
      if (line.includes('/**')) {
        open = true
        start = lineIndex
        value += `${line.trim()}\n`
        if (line.includes('*/')) {
          tokens.push({ start, end: lineIndex, value: value.trim() })
          open = false
          start = 0
          value = ''
        }
      } else if (line.includes('*/')) {
        tokens.push({ start, end: lineIndex, value: value.trim() })
        open = false
        start = 0
        value = ''
      }
    });

    await events.once(rl, 'close');
    
  } catch (err) {
    console.error(err);
  }
  return {tokens, lines}
}

const generate = async (file, output) => {    
    const {tokens, lines} = await readLines(file)
  
    for (let token of tokens) {
      token.lines = token.value.split('\n')
      let codeValue = lines[token.end.toString()]
      token.code = { 
        value: (codeValue.endsWith('}') ? codeValue : codeValue.includes('{') ? codeValue + '}' : codeValue).trim(),
        lines: lines[token.end.toString()].split('\n')
      }
      token.params = []
      token.examples = []
      token.links = []
      let value = ''
      let isExample = false
  
      if (token.code.value.includes(') => {')) {
        token.type = 'arrowFuction'
        token.name = token.code.value.split(/const|let|var|\(/g)[1] || ''
      } else if (token.code.value.includes('=')) {
        token.type = 'property'      
        token.private = token.code.value.startsWith('#')
        token.name = token.code.value.split('=')[0].trim()
        token.value = token.code.value.split('=')[1].trim()
      } else if (token.code.value.includes('class')) {
        token.type = 'class'
        token.name = token.code.value.split(/class/g)[1].split('{')[0] || ''
      } else if (token.code.value.includes('function(')) {
        token.type = 'function'
        token.name = token.code.value.split('function')[0] || ''
        token.private = token.code.value.startsWith('#')
      } else if (token.code.value.includes(') {')) {
        token.type = 'method'
        token.name = token.code.value.split('(')[0] || ''
        token.private = token.code.value.startsWith('#')
      }

      token.description = token.value.split('@')[0] || ''
  
      for (let line of token.lines) {
        if (isExample) value += line
        if (isExample && line.includes('`')) {
          token.examples.push({name: 'example', value})
          value = ''
          isExample = false
        }
        if (line.includes('@') && !isExample) {
          if (line.includes('@link')) {
            const parts = line.split(/(|)/g)
            const name = parts.slice(parts.indexOf('[') + 1, parts.indexOf(']')).join('')
            const url = parts.slice(parts.indexOf('(') + 1, parts.indexOf(')')).join('')
            
            token.links.push({name, url})
          }
          if (line.includes('@return')) {
            value = line.slice(line.indexOf('@return') + 7).trim()          
            let type = line.match(/{(.*)}/g)?.[0]
            const description = value.replace(type || '', '').trim()
            type = type?.replace(/{|}/g, '') || '__unsuported'
  
            
            const name = description.split(' ')[0]
            token.return = {name, value, type, description: description.slice(description.indexOf(name) + name.length).trim()}
            value = ''
          }
          if (line.includes('@param')) {
            value = line.slice(line.indexOf('@param') + 6).trim()
            let type = line.match(/{(.*)}/g)?.[0]
            const description = value.replace(type || '', '').trim()
  
            type = type?.replace(/{|}/g, '') || '__unsuported'
  
            const name = description.split(' ')[0]
            token.params.push({name, value, type, description: description.split(' ')[1]})
            value = ''
          }
          if (line.includes('@example')) {
            value += line
            if (line.includes('`')) {
              if (line.endsWith('`')) {
                token.examples.push({name: 'example', value: value.slice(value.indexOf('@example') + 8).replace(/`/g, '').trim()})
                value = ''
              } else {
                isExample = true
              }            
            }          
          }
        }
      }
      delete token.lines
      delete token.code.lines
    }
    // try {
      await writeFile(join(output, parse(file).base), `export default ${JSON.stringify(tokens, null, '\t')}`)
    // } catch(error) {
    //   if (error.code === 'ENOENT') await mkdir(output)
    //   await writeFile(join(output, parse(file).base), `export default ${JSON.stringify(tokens, null, '\t')}`)
    // }
  };



// declare type token = Token
/**
 * @param {object} options
 * @param {string} options.input
 */
export default async ({ input, output, readme }: {output: string, input: string, readme: string}) => {
  const files = await globby(input)
  try {
    await safeExec('rm', ['-r', output])
    await mkdir(output)    
  } catch(error) {
    await mkdir(output)
  }

  const pages = new Array()

  
  for (const file of files) {
    try {
      await generate(file, output)
      pages.push(parse(file).base)
    } catch (error) {
      console.warn(error);      
    }
    
  }
  
  let readmeString = ''

  try {
   readmeString = (await readFile(readme)).toString()
  } catch (error) {
    
  }
  const index = (await readFile(join(__dirname, 'templates', 'index.html'))).toString()
  await writeFile(join(output, 'index.html'), index
    .replace('const pages = []', `const pages = ${JSON.stringify(pages, null, '\t')}`)
    .replace('const readme = ""', 'const readme =' + JSON.stringify(readmeString, null, '\t'))
  )
}