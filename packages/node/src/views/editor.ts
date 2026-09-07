import palenightItalic from '../vs-themes/palenight-italic.json' with { type: 'json' }
import { Storage } from '@leofcoin/storage'
import { convertTheme } from '@vandeurenglenn/monaco-utils'
import { LiteElement, html } from '@vandeurenglenn/lite'
// import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
// import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'

export default customElements.define(
  'editor-view',
  class editorView extends LiteElement {
    #editor
    #enterAmount = 0
    editorStore: Storage

    dependencies = ['@leofcoin:standards']
    ready = new Promise((resolve) => {
      globalThis.pubsub.subscribe('node:ready', () => {
        resolve(true)
      })
    })

    toPathname(path: string) {
      return path.replaceAll('$__sep__', '/')
    }

    toAccessPathname(path) {
      return path.replaceAll('/', '$__sep__')
    }

    async setupStore() {
      await this.ready
      await globalThis.peernet.addStore('editor', 'lfc', '.leofcoin', true)

      this.editorStore = globalThis.editorStore
      await this.editorStore.init()
    }

    async #loadMonaco() {
      if (!globalThis.monaco) {
        const monacoUrl = new URL('./monaco/monaco-loader.js', document.baseURI).href
        const importee = await import(monacoUrl)

        globalThis.monaco = importee.default
      }

      let span = document.createElement('span')
      span.classList.add('container')
      document.body.querySelector('app-shell').appendChild(span)
    }

    async #setupContracts() {
      const contracts: { [index: string]: ArrayBuffer } = {}

      let fetcher

      try {
        contracts.token = await this.editorStore.get(this.toAccessPathname('templates/wizard/my-token.js'))
      } catch (error) {
        const contract = `
      import Token from '@leofcoin/standards/token.js'

      export default class MyToken extends Token {
        constructor(state) {
          super('MyToken', 'MTK', 18, state)
        }
      }
      `
        await this.editorStore.put(this.toAccessPathname('templates/wizard/my-token.js'), contract)
        contracts.token = await this.editorStore.get(this.toAccessPathname('templates/wizard/my-token.js'))
      }

      try {
        contracts.standard = await this.editorStore.get(this.toAccessPathname('templates/standards/token.js'))
      } catch (error) {
        fetcher = await fetch('https://raw.githubusercontent.com/leofcoin/standards/main/exports/token.js')
        await this.editorStore.put(this.toAccessPathname('templates/standards/token.js'), await fetcher.text())
        contracts.standard = await this.editorStore.get(this.toAccessPathname('templates/standards/token.js'))
      }

      try {
        contracts.roles = await this.editorStore.get(this.toAccessPathname('templates/standards/roles.js'))
      } catch (error) {
        fetcher = await fetch('https://raw.githubusercontent.com/leofcoin/standards/main/exports/roles.js')
        await this.editorStore.put(this.toAccessPathname('templates/standards/roles.js'), await fetcher.text())
        contracts.roles = await this.editorStore.get(this.toAccessPathname('templates/standards/roles.js'))
      }

      return contracts
    }

    async connectedCallback() {
      super.connectedCallback()

      try {
        await this.setupStore()
        await this.#loadMonaco()
        const { token, roles, standard } = await this.#setupContracts()

        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          ...monaco.languages.typescript.javascriptDefaults.getDiagnosticsOptions(),
          noSemanticValidation: false,
          noSuggestionDiagnostics: false,
          noSyntaxValidation: false
        })

        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
          ...monaco.languages.typescript.javascriptDefaults.getCompilerOptions(),
          target: monaco.languages.typescript.ScriptTarget.Latest,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          esModuleInterop: true,
          allowJs: true,
          checkJs: true,
          isolatedModules: true
        })

        monaco.languages.typescript.javascriptDefaults.addExtraLib(
          `
    class Roles {
      #private;
      constructor(roles: {});
      /**
       *
       */
      get state(): {};
      get roles(): {};
      /**
       * @param {address} address
       * @param {string} role
       * @returns true | false
       */
      hasRole(address: address, role: string): boolean;
      grantRole(address: address, role: string): void;
      revokeRole(address: address, role: string): void;
  }

    declare module '@leofcoin/standards/roles.js' {
      export default Roles
    };

    declare module '@leofcoin/standards/token.js' {
      export default class Token extends Roles {
        #private;
        constructor(name: string, symbol: string, decimals: number, state: {
            roles?: {};
        });
        /**
         * @return {Object} {holders, balances, ...}
         */
        get state(): {};
        get totalSupply(): any;
        get name(): string;
        get symbol(): string;
        get holders(): number;
        get balances(): {};
        mint(to: any, amount: any): void;
        burn(from: address, amount: BigInt): void;
        balanceOf(address: address): BigInt;
        setApproval(operator: address, amount: BigInt): void;
        approved(owner: address, operator: address, amount: BigInt): boolean;
        transfer(from: address, to: address, amount: BigInt): void;
    }
    };
  }`,
          'index.d.ts'
        )
        // monaco.languages.typescript.javascriptDefaults.addExtraLib(`
        // declare class Token {
        //   private #name: string;
        //   constructor(name: string, symbol: string, decimals = 18, state: object)
        // }
        // `, 'token.d.ts')

        const tokenModel = monaco.editor.createModel(
          new TextDecoder().decode(token),
          'javascript',
          monaco.Uri.parse('file://templates/my-token.js')
        )

        const standardModel = monaco.editor.createModel(
          new TextDecoder().decode(standard),
          'javascript',
          monaco.Uri.parse('file://templates/node_modules/@leofcoin/standards/token.js')
        )
        const standarRolesdModel = monaco.editor.createModel(
          new TextDecoder().decode(roles),
          'javascript',
          monaco.Uri.parse('file://templates/node_modules/@leofcoin/standards/roles.js')
        )

        monaco.editor.defineTheme('palenight-italic', convertTheme(palenightItalic))

        this.#editor = monaco.editor.create(document.querySelector('.container'), {
          theme: 'palenight-italic'
        })

        this.#editor.setModel(standardModel)
        this.#editor.setModel(standarRolesdModel)
        this.#editor.setModel(tokenModel)

        this.#editor.onKeyUp((e) => {
          const position = this.#editor.getPosition()
          const text = this.#editor.getModel().getLineContent(position.lineNumber).trim()

          if (e.keyCode !== monaco.KeyCode.Enter) this.#enterAmount = 0
          if (e.keyCode === monaco.KeyCode.Enter && !text) {
            this.#enterAmount += 1
            if (this.#enterAmount === 2) {
              this.#editor.trigger('', 'editor.action.triggerSuggest', '')
              this.#enterAmount = 0
            }
          }
        })

        pubsub.subscribe('deployment-dependencies', this.ondependencies.bind(this))

        this.shadowRoot.querySelector('button').addEventListener('click', this.deploy.bind(this))
      } catch (error) {
        console.error('Error during editor setup:', error)
      }
    }

    ondependencies(dependencies) {
      this.show(`found ${dependencies.length} dependencies
        ${JSON.stringify(dependencies)}
      `)

      setTimeout(() => {
        this.show('rolling up')
      }, 3000)
    }

    async deploy() {
      this.show('deploying')
      let code = monaco.editor.getModels()[0].getLinesContent().join('\n')
      let response = await fetch('https://deployer.leofcoin.org/bundle', {
        method: 'GET',
        body: JSON.stringify({ code, dependencies: this.dependencies })
      })

      code = await response.text()
      console.log(code)

      this.show(`
    <flex-row style="width: 100%; max-width: 640px; align-items: center;">
      <h4>${result.name}</h4>
      <flex-one></flex-one>
      <custom-svg-icon icon="close"></custom-svg-icon>
    </flex-row>
    <flex-row style="width: 100%; max-width: 640px; align-items: center; padding-bottom: 48px;">
      <h5>${result.address}</h5>
    </flex-row>

    <p style="width: 100%; max-width: 640px; overflow-y: auto;">${result.code}</p>
    `)

      this.shadowRoot.querySelector('custom-svg-icon[icon="close"]').addEventListener('click', this.hide.bind(this))
    }

    show(value) {
      this.shadowRoot.querySelector('.updates').setAttribute('shown', '')
      this.shadowRoot.querySelector('.updates').innerHTML = value
    }

    hide() {
      this.shadowRoot.querySelector('.updates').removeAttribute('shown')
      this.shadowRoot.querySelector('custom-svg-icon[icon="close"]').removeEventListener('click', this.hide.bind(this))
    }

    render() {
      return html`
        <style>
          :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
          }

          .container {
            width: 100%;
            height: 100%;
          }

          .fab {
            border-radius: 24px;
            height: 40px;
            position: absolute;
            bottom: 24px;
            right: 24px;
            z-index: 10000;
            padding: 12px 24px;
            box-sizing: border-box;
            align-items: center;
            justify-content: center;
            display: flex;
            border: 1px solid rgb(4 49 250 / 30%);
            background: #5b6f93;
            text-transform: capitalize;
            color: #eee;
          }

          .updates {
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #fff;
            z-index: 1;
            padding: 24px;
          }

          .updates[shown] {
            opacity: 1;
            pointer-events: auto;
            transition: 0.25;
          }
        </style>

        <flex-column class="updates"></flex-column>
        <button class="fab">publish</button>
        <flex-column class="container">
          <slot></slot>
        </flex-column>
      `
    }
  }
)
