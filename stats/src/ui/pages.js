import './../../node_modules/custom-pages/src/custom-pages'

export default html`
<custom-pages attr-for-selected="data-route">
  <home-view data-route="home"></home-view>
  <connect-view data-route="connect"></connect-view>
  <history-view data-route="history"></history-view>
</custom-pages>
`