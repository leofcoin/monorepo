import hljs from './../../node_modules/highlight.js/lib/core';
import javascript from './../../node_modules/highlight.js/lib/languages/javascript';
import './../../highlight.js/styles/github.css';
hljs.registerLanguage('javascript', javascript);

export default customElements.define('highlight-element', class HighlightElement extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
  }

  connectedCallback() {
    hljs.highlightAll()
  }

  set code(value) {
    this._code = value
  }

  get code() {
    return this._code || ''
  }

  render(code) {
    this.code = code
    hljs.highlightAll()
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
      }
    </syle>
    <pre><code class="language-javascript">${this.code}</code></pre>`
  }
})
