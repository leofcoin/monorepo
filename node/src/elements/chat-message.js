export default customElements.define('chat-message', class ChatMessage extends BaseClass {
  constructor() {
    super()
  }

  set value(value) {
    this.shadowRoot.querySelector('.value').innerHTML = value
  }

  set author(author) {
    this._author = author
    if (author.length > 34) {
      author = `${author.slice(4, 9)}...${author.slice(author.length - 5, author.length)}`
    }
    this.shadowRoot.querySelector('.author').innerHTML = author
    this.shadowRoot.querySelector('.author').style.color = authorColor(this._author)
    this.shadowRoot.querySelector('.author').title = this._author
  }

  get template() {
    return html`
    <style>
      :host {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: 24px;
      }
      .author {
        font-size: 13px;
      }
    </style>
    <span class="author"></span>
    <span class="value"></span>

    `
  }
})
