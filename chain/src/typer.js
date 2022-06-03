import {BigNumber} from './utils/utils'

const codec = '0x'

const isAddress = address => {
  if (!address.startsWith(codec)) return false
  if (address.length !== 64) return false
}

export default {
  isType: (type, value) => {
    type = type.toLowercase()
    if (type === 'string') return typeof(value) === type
    if (type === 'number') return !isNaN(Number(value))
    if (type === 'address') return isAddress(value)
    if (type === 'BigNumber') return BigNumber.isBigNumber(value)
  },
  isAddress
}
