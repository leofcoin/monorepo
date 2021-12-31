import codec from './../codecs/address'

export default {
  create: hash => {
    return `${codec}${hash.slice(0, 60).toString('hex')}`
  }
}
