const isAddress = address => {
  if (!address.startsWith(codec)) return false
  if (address.length !== 64) return false
}

export default {
  isType: (type, value) => {
    type = type.toLowercase()
    if (type === 'string') return typeof(value) === type
    if (type === 'address') return isAddress(value)
  }
}
