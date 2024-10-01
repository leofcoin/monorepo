export default class Contract {
  constructor(address, ABI, provider, config) {
    this.address = address
    this.ABI = ABI
    this.contract = {
      methods: {
        ...ABI.reduce((acc, { name }) => {
          acc[name] = async (...args) => {
            const { data } = this.contract.methods[name](...args).encodeABI()
            return provider.sendTransaction({ data })
          }
          return acc
        }, {})
      }
    }
  }

  proxy() {
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop]
        } else {
          return this.contract.methods[prop]
        }
      }
    })
  }
}
