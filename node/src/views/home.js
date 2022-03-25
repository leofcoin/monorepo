import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import './../elements/chat-box'
import './../elements/chat-message'
import './../elements/author-message'
export default customElements.define('home-view', class HomeView extends BaseClass {
  constructor() {
    super()
    this._onclick = this._onclick.bind(this)
  }

  async hasMessage(hash) {
    const hasHash = await peernet.message.has(hash)
    return hasHash || this.shadowRoot.querySelector(`chat-message[data-hash='${hash}']`)
  }

  async _init() {
    let messages = await messageStore.get()
    messages = Object.keys(messages).map(key => new peernet.protos['chat-message'](messages[key]))
    messages = messages.sort((previous, current) => previous.decoded.timestamp - current.decoded.timestamp)
    for (const message of messages) {
      try {
        const chatMessage = message.decoded.author === peernet.id ? document.createElement('author-message') : document.createElement('chat-message')
        this.shadowRoot.querySelector('.chat-messages').appendChild(chatMessage)
        chatMessage.dataset.hash = message.hash
        chatMessage.value = message.decoded.value
        chatMessage.author = message.decoded.author
        chatMessage.timestamp = message.decoded.timestamp
        this.shadowRoot.querySelector('.chat-messages').scroll(0, this.shadowRoot.querySelector('.chat-messages').scrollHeight)
      } catch (e) {

      }
    }

  }

  connectedCallback() {
    peernet.addRequestHandler('messages', async () => {
      let messages = await messageStore.get()

      return new peernet.protos['peernet-response']({
        response: JSON.stringify(Object.keys(messages))
      })
    })

    pubsub.subscribe('peernet-ready', () => {
      this._init()
    })

    pubsub.subscribe('peer:connected', async peer => {
      const request = new globalThis.peernet.protos['peernet-request']({request: 'messages'})
      const to = peernet._getPeerId(peer.id)
      console.log(to);
      if (to) {
        const node = await peernet.prepareMessage(to, request.encoded)
        let response = await peer.request(node.encoded)
        const proto = new globalThis.peernet.protos['peernet-message'](peernet.Buffer.from(response.data))
        response = new globalThis.peernet.protos['peernet-response'](peernet.Buffer.from(proto.decoded.data))
        const messages = JSON.parse(response.decoded.response)
        for (const message of messages) {
          if (!await peernet.message.has(message)) {
            let data = await peernet.message.get(message)
            await peernet.message.put(message, data)

            data = new peernet.protos['chat-message'](data)

            const chatMessage = document.createElement('chat-message')
            this.shadowRoot.querySelector('.chat-messages').appendChild(chatMessage)
            chatMessage.dataset.hash = data.hash
            chatMessage.value = data.decoded.value
            chatMessage.author = data.decoded.author
            chatMessage.timestamp = data.decoded.timestamp
            this.shadowRoot.querySelector('.chat-messages').scroll(0, this.shadowRoot.querySelector('.chat-messages').scrollHeight)
          }
        }
      }
    })

    peernet.subscribe('chat-message', async message => {

      message = JSON.parse(message)
      if (!await this.hasMessage(message.hash)) {
        const hash = message.hash
        delete message.hash
        message = new peernet.protos['chat-message'](message)
        if (message.hash === hash) {
          await peernet.message.put(message.hash, message.encoded)

          const chatMessage = document.createElement('chat-message')
          this.shadowRoot.querySelector('.chat-messages').appendChild(chatMessage)
          chatMessage.dataset.hash = hash
          chatMessage.value = message.decoded.value
          chatMessage.author = message.decoded.author
          chatMessage.timestamp = message.decoded.timestamp

          this.shadowRoot.querySelector('.chat-messages').scroll(0, this.shadowRoot.querySelector('.chat-messages').scrollHeight)
        }

      }

    })



    peernet.subscribe('typing-message', async message => {
      // if (!await peernet.message.has(message)) {
        const color = authorColor(message)
        this.shadowRoot.querySelector('.typing').style.color = color
        this.shadowRoot.querySelector('.typing').innerHTML = `${message.slice(0, 5)}...${message.slice(message.length - 6, message.length)} typing ...`
      // }

    })
    this.addEventListener('click', this._onclick)
  }

  async _onclick(event) {
    const target = event.composedPath()[0]
    if (!target.localName === 'emoji-selector' && this.shadowRoot.querySelector('chat-box').shadowRoot.querySelector('emoji-selector').opened) this.shadowRoot.querySelector('chat-box').shadowRoot.querySelector('emoji-selector').close()
  }

  get template() {
    return html`
<style>
  * {
    font-family: 'Noto Sans', sans-serif;
  }
  :host {
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    position: relative;
  }
  h4 {
    margin: 0;
  }
  section {
    width: 100%;
    height: 220px;
    padding-bottom: 24px;
  }
  .container {
    <!-- max-width: 480px; -->
    overflow: hidden;
    <!-- max-height: 80%; -->
  }
  .container, section {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  flex-row {
    width: 100%;
    align-items: center;

    box-sizing: border-box;
    padding: 0 48px;
  }

  .top {
    padding-top: 24px;
    background: #573e6a;
    color: #eee;
  }

  .bottom {
    padding-bottom: 24px;
    background: #573e6a;
    color: #eee;
  }

  button {
    background: #573e6a;
    padding: 12px 24px;
    box-sizing: border-box;
    border-radius: 12px;
    color: #eee;
    border-color: #eee;
    font-weight: 700;
    text-transform: uppercase;
    pointer-events: auto;
    cursor: pointer;
  }

  custom-input {
    width: 100%;
    pointer-events: auto;
    max-width: 332px;
    border-radius: 12px;
  }

  .list {
    box-sizing: border-box;
    padding: 12px;
    font-size: 13px;
  }

  strong.address {
    font-size: 13px;
  }
  .chat-messages {
    height: 100%;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    overflow: auto;
  }

</style>

<!-- <section class="container">
  <h1>ArtOnline Node</h1>
  <strong class="address"></strong>
  <flex-row>
    <strong>peers</strong>
    <flex-one></flex-one>
    <span class="peerCount"></span>
  </flex-row>

  <flex-one></flex-one>
  <flex-column class="list">
    <slot></slot>
  </flex-column>


  <!-- <custom-input placeholder="address"></custom-input>
  <flex-two></flex-two>
  <button>GET ART</button> -->
<!-- </section> -->

<section class="container">
  <span class="chat-messages"></span>
  <flex-one></flex-one>
  <small class="typing"></small>
  <chat-box></chat-box>
</section>
    `
  }
})
