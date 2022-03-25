import './emoji-selector'
import './author-message'
export default customElements.define('chat-box', class ChatBox extends BaseClass {
  constructor() {
    super()
    this._sendMessage = this._sendMessage.bind(this)
  }

  _emojiSelector = this.shadowRoot.querySelector('emoji-selector')
  _input = this.shadowRoot.querySelector('input')
  _send = this.shadowRoot.querySelector('[icon="send"]')

  connectedCallback() {
    this._input.addEventListener('input', () => {
      peernet.publish('typing-message', peernet.id)
      const matches = this._input.value.match(/:(.*):/g);
      if (matches && matches.length > 0) {
        for (let keyword of matches) {
        keyword = keyword.replace(/:/g, '');
          for (const i of Object.keys(emojis)) {
            const index = emojis[i].indexOf(keyword);
            if (emojis[i].indexOf(keyword) !== -1) {
              const reg = new RegExp(`:${keyword}:`, 'g');
              this._input.value = this._input.value.replace(reg, i);
              return;
            }
          }
        }
      }
    });
    document.addEventListener('keydown', ({key, shiftKey}) => {
      if (key === 'Enter' && !shiftKey) this._sendMessage()
    })
    this._emojiSelector.addEventListener('selected', ({detail}) => {
      console.log(detail);
      this._input.value += detail;
    });
    this._send.addEventListener('click', this._sendMessage)
  }

  async _sendMessage() {
    if (this._input.value.length === 0) return
    const chatMessage = document.createElement('author-message')
    chatMessage.value = this._input.value
    chatMessage.author = peernet.id
    document.querySelector('node-shell').shadowRoot.querySelector('home-view').shadowRoot.querySelector('.chat-messages').appendChild(chatMessage)


    const timestamp = new Date().getTime()
    let message = {
      author: peernet.id,
      value: this._input.value,
      timestamp
    }
    message = new peernet.protos['chat-message'](message)

    await peernet.message.put(message.hash, message.encoded)

    peernet.publish('chat-message', JSON.stringify({
      ...message.decoded,
      hash: message.hash
    }))

    this._input.value = null
  }

  get template() {
    return html`
    <style>
      :host {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 100px;
        height: auto;
        bottom: 0;
        left: 0;
        right: 0;
        /* padding: 0 12px; */
        box-sizing: border-box;
        box-shadow: 2px 0px 2px 0 rgba(0, 0, 0, 0.14);

        align-items: center;
      }

      input {
        width: 100%;
        display: flex;
        height: 54px;
        min-height: 54px;
        padding: 8px;
        box-sizing: border-box;
        border: none;
        user-select: none;
        outline: none;
        z-index: 100;
        font-size: 22px;
        padding: 0 20px;
        background: var(--primary-color);
        color: var(--primary-text-color);
      }

      flex-row {
        align-items: center;
        width: 100%;
      }

      custom-svg-icon {
        margin-right: 24px;
        cursor: pointer;
        pointer-events: auto;
        --svg-icon-color: #fff;
      }
      input {
        pointer-events: auto;
        color: #fff;
      }
    </style>
    <emoji-selector></emoji-selector>
    <flex-row>
      <input class="chat-input" type="text" value="" placeholder="Type here" autofocus autocomplete></input>
      <custom-svg-icon icon="send"></custom-svg-icon>
    </flex-row>

    `
  }
})
