export default customElements.define('custom-toast', class CustomToast extends BaseClass {
  constructor() {
    super()
  }

  set title(value) {
    this.shadowRoot.querySelector('.title').innerHTML = value
  }

  set description(value) {
    this.shadowRoot.querySelector('.description').innerHTML = value
  }

  show(title, description) {
    this.title = title
    this.description = description
    return new Promise((resolve, reject) => {
      const timeout = () => setTimeout(() => {
          resolve('close')
        }, 10000)
      timeout()
      const click = event => {
        if (event.composedPath[0].hasAttribute('data-action')) resolve('close')
        clearTimeout(timeout)
      }
      this.addEventListener('click', click)

    });
  }

  get template() {
    return html`
<style>
  :host {
    display: flex;
    flex-direction: column;
    padding: 6px 12px;
    box-sizing: border-box;
    width: 100%;
    background: #fff;
    border-radius: 12px;
  }

  h5, p {
    margin: 0;
  }
  h5 {
    padding-bottom: 6px;
  }
</style>

<h5 class="title"></h5>
<p class="description"></p>
    `
  }
})
