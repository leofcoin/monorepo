import addresses from './addresses.json' assert { type: 'json' }

export const contractFactory = addresses.contractFactory
export const nameService = addresses.nameService
export const nativeToken = addresses.nativeToken
export const validators = addresses.validators
export default {
  contractFactory,
  nameService,
  nativeToken,
  validators
}