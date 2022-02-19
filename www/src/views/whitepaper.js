import './../elements/custom-hero'
import './../elements/eyedrop'
import './../../node_modules/pdfjs-dist/build/pdf.min'

export default customElements.define('whitepaper-view', class WhitepaperView extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this._onclick = this._onclick.bind(this)
    this.shadowRoot.innerHTML = `
      <style>
        * {
          user-select: none;
          pointer-events: none;
        }
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow-y: auto;
          pointer-events: auto;
          padding: 0 24px 24px 24px;
          box-sizing: border-box;
          overflow-y: auto;
          background: var(--secondary-background-color);
          font-family: 'Noto Sans', sans-serif;
          color: var(--secondary-accent-color);
        }

        button {
          justify-content: center;
          align-items: center;
          background: var(--secondary-accent-color);
          border: none;
          font-size: 32px;
          height: 48px;
          width: 48px;
          border-radius: 50%;
          box-sizing: border-box;
          color: var(--main-accent-color);
          cursor: pointer;
          pointer-events: auto;
        }

        .nav {
          padding-top: 16px;
          width: 100%;
          max-width: 480px;
          margin-top: -86px;
          z-index: 1;
        }
      </style>
      <canvas></canvas>
      <flex-row class="nav">
        <button data-action="previous">&lt;</button>
        <flex-one></flex-one>
        <button data-action="next">&gt;</button>

      </flex-row>
      <!-- <iframe src="./whitepaper.pdf"></iframe> -->
    `
  }

  connectedCallback() {
    this._loadPDF()
    this.addEventListener('click', this._onclick)
  }

  async _onclick(event) {
    const target = event.composedPath()[0]
    if (target.hasAttribute('data-action')) {
      const action = target.getAttribute('data-action')
      if (action === 'previous' && this._currentPage > 1) this._currentPage -= 1
      if (action === 'next' && this._currentPage < this.totalPages) this._currentPage += 1

      this._renderPage(this._currentPage)
    }
  }

  async _renderPage(pageNumber) {
    this.totalPages = this.pdfDoc.numPages
    const page = await this.pdfDoc.getPage(pageNumber)

    const scale = 0.8;
    const viewport = page.getViewport({scale: scale});

    // Prepare canvas using PDF page dimensions
    const canvas = this.shadowRoot.querySelector('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page into canvas context
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    const renderTask = page.render(renderContext);
  }

  async _loadPDF() {
    const pdfjsLib = exports['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.js';

    const loadingTask = pdfjsLib.getDocument('./whitepaper.pdf');
    const pdf = await loadingTask

    this.pdfDoc = await pdf._capability.promise;
    this._currentPage = 1
    this._renderPage(this._currentPage)
  }
})
