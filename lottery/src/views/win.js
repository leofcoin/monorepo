export default customElements.define('win-view', class WinView extends BaseClass {
  constructor() {
    super()
  }

  set value(amount) {
    this.innerHTML = `You won ${ethers.utils.formatUnits(amount)} ART`
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
  }
  h4 {
    margin: 0;
  }
  section {
    width: 100%;
    height: 480px;
    padding-bottom: 12px;
  }
  .container {
    background: var(--secondary-background-color);
    max-width: 312px;
    border-radius: 48px;
    box-shadow: 0 0 7px 9px #00000012;
    overflow: hidden;
  }
  .container, section {
    display: flex;
    flex-direction: column;
    width: 100%;


    align-items: center;
    justify-content: center;
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

  .wrapper {
    background-color: rgb(238, 234, 244);
    border: 1px solid rgb(215, 202, 236);
    border-radius: 16px;
    box-shadow: rgb(74 74 104 / 10%) 0px 2px 2px -1px inset;
    padding: 8px 16px;
    display: flex;
    max-width: 230px;
  }

   flex-column {
     box-sizing: border-box;
     padding: 24px;
     width: 100%;
   }

   input {
     pointer-events: auto;
     background: transparent;
     border: none;
     width: 22px;
     -webkit-appearance: none;
     text-align: end;
     outline: none;
   }



   .logo {
     height: 18px;
     width: 18px;
     padding-left: 6px;
   }

   .ticketPrice, .cost {
     align-items: center;
     display: flex;
   }
   array-repeat {
     height: 100%;
     width: 100%;
     overflow-y: auto;
     pointer-events: auto;
   }

   span[slot="content"] {
     justify-content: center;
     width: 100%;
     display: flex;
     flex-direction: column;
     align-items: center;
     overflow-y: auto;
     pointer-events: auto;
   }
</style>

<section class="container">
  <flex-row class="top">
    <h4>buy tickets</h4>
    <flex-one></flex-one>
    <custom-svg-icon icon="cancel"></custom-svg-icon>
  </flex-row>
  <flex-row class="bottom"></flex-row>
  <flex-one></flex-one>

  <slot></slot>
</section>
<!-- lastwinner -->

<!-- tickets -->

<!-- buy tickets -->
    `
  }
})
