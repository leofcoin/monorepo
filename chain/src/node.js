import config from './config/config'
import Connect from './peernet/connect'


export default class Node {
  constructor() {
    return this._init()
  }

  async _init() {
    this.config = await config()
  }

}
