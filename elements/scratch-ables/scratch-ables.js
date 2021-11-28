// import { ScratchCard, SCRATCH_TYPE } from "scratchcard-js";


export default customElements.define('scratch-ables', class ScratchAbles extends HTMLElement {
  get scratchCardContainer() {
    return this.querySelector('.container')
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.innerHTML = this.template
    this.innerHTML = `<span class="container"></span>`
    
  }

  render(foreground, background) {
    this.scratchCard = new ScratchCard('.container', {
      scratchType: SCRATCH_TYPE.LINE,
      containerWidth: this.scratchCardContainer.offsetWidth,
      containerHeight: this.scratchCardContainer.offsetHeight,
      imageForwardSrc: foreground,
      imageBackgroundSrc: background,
      clearZoneRadius: 15,
      percentToFinish: 30, // When the percent exceeds 50 on touchend event the callback will be exec.
      callback: function () {
        alert("Card Scratched");
      }
    });
    this.scratchCard.init().then(() => {
      this.scratchCard.canvas.addEventListener("scratch.move", () => {
        this.scratchCard.getPercent().toFixed(2);
      });
    });
  }

  get template() {
    return `
    <style>
      :host {
        display: flex;
        flex-direction: column;
      }

      ::slotted(*) {
        display: block;
        position: relative;
        overflow: hidden;
          height: 426px;
          width: 320px;
      }
    </style>
    <slot></slot>

    `
  }
})
