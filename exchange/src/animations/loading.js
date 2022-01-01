export default customElements.define('loading-animation', class loadingAnimation extends BaseClass {
  constructor() {
    super()
  }

  get template() {
    return html`
    <style>
      :host {
        display: block;
        margin: 0 auto;
        background-color: #000;
        border-radius: 50%;
        width: 240px;
        height: 240px;
        /* animation: spin 2s linear infinite; */
      }

      span {
        position: absolute;
        display: block;
        background-color: transparent;
        /* border: 16px solid transparent; */
        border-radius: 50%;
        border-top: 16px solid var(--accent-color);
        width: 240px;
        height: 240px;
        box-shadow: 0px 0px 20px 9px #72167282;
      }

      .top {
        animation: spin 2s linear infinite;
        border-bottom: 16px solid violet;
      }

      .bottom {
        border-top: 16px solid violet;
        border-bottom: 16px solid var(--accent-color);
        animation: spinback 2s linear infinite;
      }

      .between {
        border-top: 16px solid #721672;
        border-bottom: 16px solid rgb(255 81 242);
        animation: spinback 2s cubic-bezier(0.1, 0, 1, 1) infinite;
      }

      .between-2 {
        border-top: 16px solid rgb(255 81 242);
        border-bottom: 16px solid #721672;
        animation: spin 2s cubic-bezier(0.1, 0, 1, 1) infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @keyframes spinback {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(-360deg); }
      }
    </style>

    <span class="top"></span>
    <span class="between"></span>
    <span class="between-2"></span>
    <span class="bottom"></span>

    <!-- <span class="bottom-left"></span> -->

    `
  }
})
