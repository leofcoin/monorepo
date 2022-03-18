import './../../node_modules/@andrewvanardennen/custom-input/custom-input'
import './../elements/chat-box'
import './../elements/chat-message'
export default customElements.define('home-view', class HomeView extends BaseClass {
  constructor() {
    super()
    this._onclick = this._onclick.bind(this)
  }

  async hasMessage(hash) {
    const hasHash = await peernet.message.has(hash)
    return hasHash || this.shadowRoot.querySelector(`chat-message[data-hash='${hash}']`)
  }

  connectedCallback() {
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
        }

      }

    })

    peernet.subscribe('typing-message', async message => {
      // if (!await peernet.message.has(message)) {
        this.shadowRoot.querySelector('.typing').innerHTML = `${message} typing ...`
      // }

    })
    // this.shadowRoot.querySelector('button').addEventListener('click', this._onclick)
    // const update = async () => {
    //   this.shadowRoot.querySelector('.peerCount').innerHTML = peernet.peerMap.size
    //   this.shadowRoot.querySelector('.address').innerHTML = peernet.id
    //
    //   for (const key of peernet.peerMap.keys()) {
    //     if (!this.querySelector(`[data-address='${key}']`)) {
    //       const row = document.createElement('flex-row')
    //       row.innerHTML = key
    //       row.dataset.address = key
    //       this.appendChild(row)
    //     }
    //   }
    //   setTimeout(() => {
    //     update()
    //   }, 1000);
    // }
    //
    // update()
  }

  async _onclick() {
    const value = this.shadowRoot.querySelector('custom-input').input.value
    let response = await fetch(`https://api.artonline.site/faucet?address=${value}`)
    console.log(await response.text());
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
    background: var(--secondary-background-color);
    max-width: 480px;
    border-radius: 48px;
    box-shadow: 0 0 7px 9px #00000012;
    overflow: hidden;
    max-height: 80%;
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
  <span class="typing"></span>
  <chat-box></chat-box>
</section>
    `
  }
})
