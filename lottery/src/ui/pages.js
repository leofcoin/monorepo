import './../../node_modules/custom-pages/src/custom-pages'

export default html`
<custom-pages attr-for-selected="data-route">
  <home-view data-route="home"></home-view>
  <connect-view data-route="connect"></connect-view>
  <buy-view data-route="buy"></buy-view>
  <history-view data-route="history"></history-view>
  <tickets-view data-route="tickets"></tickets-view>
  <results-view data-route="results"></results-view>
  <win-view data-route="win"></win-view>
</custom-pages>
`
