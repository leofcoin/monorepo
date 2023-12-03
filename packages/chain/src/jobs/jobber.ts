import { Protocol } from '../protocol.js'

export default class Jobber {
  timeout: EpochTimeStamp
  busy: boolean = false
  destroy: Function

  constructor(timeout) {
    this.timeout = timeout
  }

  add(fn) {
    this.busy = true
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject('timeout')
      }, this.timeout)

      this.destroy = () => {
        clearTimeout(timeout)
        this.busy = false
        resolve('stopped')
      }

      try {
        const result = await fn()
        clearTimeout(timeout)
        this.busy = false
        resolve(result)
      } catch (error) {
        clearTimeout(timeout)
        reject(error)
      }
    })
  }
}
