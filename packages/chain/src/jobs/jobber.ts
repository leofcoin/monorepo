export default class Jobber {
  timeout: EpochTimeStamp
  busy: boolean = false
  destroy?: () => void

  constructor(timeout: number) {
    this.timeout = timeout
  }

  add<T>(fn: () => T | Promise<T>): Promise<T | string> {
    this.busy = true
    return new Promise<T | string>(async (resolve, reject) => {
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
