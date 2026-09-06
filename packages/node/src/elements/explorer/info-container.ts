import { html, LitElement } from 'lit'
import {map} from 'lit/directives/map.js'
import './info.js'

export default customElements.define('explorer-info-container', class ExplorerInfoContainer extends LitElement {
  static properties = {
    items: {
      type: Array
    }
  }

  constructor() {
    super()

    this.attachShadow({mode: 'open'})
  }




  render() {
    return html`
<style>
  :host {
    display: flex;
    flex-direction: row;
    max-width: 600px;
    width: 100%;
    height: 136px;
  }

  @media (max-width: 601px) {
    :host {
      flex-direction: column;
      height: 272px;
    }
    explorer-info[index="0"] {
      margin-bottom: 12px;
    }
  }

</style>

${map(this.items, (item, index) => html`
  <explorer-info title=${item.title} items=${JSON.stringify(item.items)} index=${index}></explorer-info>
`)}
`
  }
})
