import { html, LitElement } from "lit";
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
import {interval} from './lib/time.js'

TimeAgo.addDefaultLocale(en)

export default customElements.define('time-ago', class TimeAgoElement extends LitElement {
  static properties = {
    value: {
      type: Number
    }
  }
  constructor() {
    super()
    this.timeAgo = new TimeAgo('en-US')
    pubsub.subscribe('interval:1000', () => {
      this.innerHTML = this.timeAgo.format(this.value)
    })
    interval()

  }

  render() {
    return html`
    <style>


    </style>
    <slot>${this.timeAgo.format(this.value)}</slot>

    `
  }

})