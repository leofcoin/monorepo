import { Protocol } from "../protocol.js";

export default class Jobber {
  timeout: EpochTimeStamp;
  busy: boolean = false;
  stop: Function;

  constructor(timeout) {
    this.timeout = timeout
  }

  add(fn) {
    this.busy = true
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject('timeout')
      },this.timeout)

      this.stop = () => {
        clearTimeout(timeout)
        this.busy = false
        resolve('stopped')
      }

      const result = await fn()
      clearTimeout(timeout)
      this.busy = false
      resolve(result)
      
    })
  }

}