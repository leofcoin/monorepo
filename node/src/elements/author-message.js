export default customElements.define('author-message', class AuthorMessage extends BaseClass {
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
        width: 100%;
        padding: 12px 24px;
        font-size: 13px;
      }
      .author {
        font-size: 13px;
      }
      flex-column {
        box-sizing: border-box;
        padding: 12px 24px;
        background: var(--secondary-background-color);
        border-radius: 24px;
        box-shadow: 0 0 7px 9px #00000012;
      }
    </style>
    <flex-row>
      <flex-one></flex-one>
      <flex-column>
        <flex-row>
          <span class="author"></span>
        </flex-row>
        <flex-row>
          <flex-one></flex-one>
          <span class="value"></span>
        </flex-row>
      </flex-column>
    </flex-row>
    `
  }
})
