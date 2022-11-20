import { version } from './../../../package.json'

import * as monaco from 'monaco-editor';
export default customElements.define('editor-view', class editorView extends HTMLElement {
  #validators = []

  constructor() {
    super()

    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }


  async connectedCallback() {

globalThis.MonacoEnvironment = {
	getWorkerUrl: function (moduleId, label) {
		if (label === 'json') {
			return './json.worker.bundle.js';
		}
		if (label === 'css' || label === 'scss' || label === 'less') {
			return './css.worker.bundle.js';
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor') {
			return './html.worker.bundle.js';
		}
		if (label === 'typescript' || label === 'javascript') {
			return './ts.worker.bundle.js';
		}
		return './editor.worker.bundle.js';
	}
};
const span = document.createElement('span')
span.classList.add('container')
document.body.appendChild(span)
const token = await api.readFile('./node_modules/@leofcoin/chain/src/contracts/nativeToken.js')

monaco.editor.create(document.querySelector('.container'), {
	value: new TextDecoder().decode(token),
	language: 'javascript'
});
  }

  get template() {
    return `
<style>
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
  }

.container {
  width: 100%;
  height: 100%;
}


</style>


<flex-column class="container" >
<slot></slot>
</flex-column>
    `
  }
})
