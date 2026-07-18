import codecs from './codecs.js'
import type { CodecEntry } from './codecs.js'

type CodecMap = Record<string, { hashAlg: string; codec: number }>

const registry: CodecMap = {}

const addCodec = (codecInput: CodecEntry) => {
  const { hashAlg, codec, name } = codecInput
  if (!registry[name])
    registry[name] = {
      hashAlg,
      codec: typeof codec === 'string' ? parseInt(codec, 16) : codec
    }
}

for (const codec of codecs) {
  addCodec(codec)
}

const getCodecByName = (name: string) => registry[name]

const getCodecName = (codec: number): string | undefined => {
  return Object.keys(registry).reduce<string | undefined>((p, c) => {
    return registry[c].codec === codec ? c : p
  }, undefined)
}

const getCodec = (name: string | number): number => {
  if (typeof name === 'number') return name
  return getCodecByName(name).codec
}

const getHashAlg = (name: string | number): string => {
  if (typeof name === 'number') return getCodecByName(getCodecName(name)!).hashAlg
  return getCodecByName(name).hashAlg
}

const isCodec = (codec: any): boolean => {
  return codec.codec !== undefined && !!codec.hashAlg
}

const validateCodec = (codec: any) => {
  if (codec.codec === undefined || codec.hashAlg === undefined || codec.name === undefined)
    throw new Error(`invalid codecInput: ${codec}`)
}

const utils = {
  isCodec,
  addCodec,
  getCodec,
  getHashAlg,
  getCodecName,
  validateCodec,
  codecs: registry
}

export default utils
