import launch from './exports/index.js'

const { chain, endpoints, clients, mode } = await launch({
  network: 'leofcoin:peach',
  networkVersion: 'peach',
  mode: 'direct'
})
console.log(await clients.ws[0].networkStats())
