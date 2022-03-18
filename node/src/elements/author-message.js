export default customElements.define('author-message', class AuthorMessage extends BaseClass {
  constructor() {
    super()
  }

  set value(value) {
    this.shadowRoot.querySelector('.value').innerHTML = value
  }

  set author(author) {
    this.shadowRoot.querySelector('.author').innerHTML = author
    this.shadowRoot.querySelector('.author').style.color = authorColor(author)
  }

  get template() {
    return html`
    <style>
      :host {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: 24px;
        width: 100%;
      }
      .author {
        font-size: 13px;
      }
    </style>
    <flex-row>
      <flex-one></flex-one>
      <span class="author"></span>
    </flex-row>
    <flex-row>
      <flex-one></flex-one>
      <span class="value"></span>
    </flex-row>
    `
  }
})
