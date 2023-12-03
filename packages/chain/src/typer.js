import { BigNumber } from '@leofcoin/utils'

const codec = '0x'

const isAddress = (address) => {
  if (!address.startsWith(codec)) return false
  if (address.length !== 64) return false
}

export default {
  isType: (type, value) => {
    type = type.toLowercase()
    if (type === 'string') return typeof value === type
    if (type === 'number') return !Number.isNaN(Number(value))
    if (type === 'address') return isAddress(value)
    if (type === 'BigNumber') return BigNumber.isBigNumber(value)
  },
  isAddress
}
