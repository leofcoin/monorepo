import ethers from 'ethers'

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

globalThis.provider = provider
export provider
