import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import './../elements/chat-box'
import './../elements/chat-message'
import './../elements/author-message'
export default customElements.define('home-view', class HomeView extends BaseClass {
  constructor() {
    super()
    this._que = []
    this._onclick = this._onclick.bind(this)
  }

  async hasMessage(hash) {
    const hasHash = await peernet.message.has(hash)
    return hasHash || this.shadowRoot.querySelector(`chat-message[data-hash='${hash}']`)
  }

  async _init() {
    let messages = await messageStore.get()
    messages = Object.keys(messages).reduce((set, key) => {
      try {
        const message = new peernet.protos['chat-message'](messages[key])
        set.push(message)
      } catch (e) {
        messageStore.delete(key)
      }
      return set
    }, [])
    messages = messages.sort((previous, current) => previous.decoded.timestamp - current.decoded.timestamp)
    for (const message of messages) {
      const chatMessage = message.decoded.author === peernet.id ? document.createElement('author-message') : document.createElement('chat-message')
      this.shadowRoot.querySelector('.chat-messages').appendChild(chatMessage)
      chatMessage.dataset.hash = message.hash
      chatMessage.value = message.decoded.value
      chatMessage.author = message.decoded.author
      chatMessage.timestamp = message.decoded.timestamp
      this.shadowRoot.querySelector('.chat-messages').scroll(0, this.shadowRoot.querySelector('.chat-messages').scrollHeight)
    }

  }

  connectedCallback() {
    peernet.addRequestHandler('messages', async () => {
      let messages = await messageStore.get()

      return new peernet.protos['peernet-response']({
        response: JSON.stringify(Object.keys(messages))
      })
    })
    this._init()

    pubsub.subscribe('peer:connected', async peer => {
      const request = new globalThis.peernet.protos['peernet-request']({request: 'messages'})
      const to = peernet._getPeerId(peer.id)
      console.log(`fetvhing messages from ${to}`);
      console.log(to);
      if (to) {
        const node = await peernet.prepareMessage(to, request.encoded)
        let response = await peer.request(node.encoded)
        const proto = new globalThis.peernet.protos['peernet-message'](peernet.Buffer.from(response.data))
        response = new globalThis.peernet.protos['peernet-response'](peernet.Buffer.from(proto.decoded.data))
        const messages = JSON.parse(response.decoded.response)

        let promises = []
        for (const message of messages) {
          console.log(message);
          const has = await peernet.message.has(message)
          console.log({has});
          if (!has) {
            promises.push(peernet.message.get(message))
          }
        }
        promises = await Promise.all(promises)
        promises = promises.reduce((set, data) => {
          console.log(data);
          try {
            data = new peernet.protos['chat-message'](data)
            set.push(data)
          } catch (e) {

          }
          return set
        }, [])
        console.log(promises);
        promises = promises.sort((previous, current) => previous.decoded.timestamp - current.decoded.timestamp)

        for (let data of promises) {
          try {
            await peernet.message.put(data.hash, data.encoded)
            if (!this.shadowRoot.querySelector(`[data-hash="${data.hash}"]`)) {
              const chatMessage = document.createElement('chat-message')
              this.shadowRoot.querySelector('.chat-messages').appendChild(chatMessage)
              chatMessage.dataset.hash = data.hash
              chatMessage.value = data.decoded.value
              chatMessage.author = data.decoded.author
              chatMessage.timestamp = data.decoded.timestamp
              this.shadowRoot.querySelector('.chat-messages').scroll(0, this.shadowRoot.querySelector('.chat-messages').scrollHeight)
            }

          } catch (e) {
            console.warn(`ignored invalid message`);
          }
        }

      }
    })

    peernet.subscribe('chat-message', async message => {
      this._addToQue(message)



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

  _addToQue(message) {
    this._que.push(message)
    if (!this._queRunning) this._runQue()


  }

  async _runQue() {
    this._queRunning = true
    let message = this._que.shift()
    message = JSON.parse(message)
    if (!await this.hasMessage(message.hash)) {
        delete message.hash
        message = new peernet.protos['chat-message'](message)
        await peernet.message.put(message.hash, message.encoded)

        const chatMessage = document.createElement('chat-message')
        this.shadowRoot.querySelector('.chat-messages').appendChild(chatMessage)
        chatMessage.dataset.hash = message.hash
        chatMessage.value = message.decoded.value
        chatMessage.author = message.decoded.author
        chatMessage.timestamp = message.decoded.timestamp

        this.shadowRoot.querySelector('.chat-messages').scroll(0, this.shadowRoot.querySelector('.chat-messages').scrollHeight)

    }
    if  (this._que.length > 0) return this._runQue()
    this._queRunning = false
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
