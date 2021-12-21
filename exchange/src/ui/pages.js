import './../../node_modules/custom-pages/src/custom-pages'

export default html`
<custom-pages attr-for-selected="data-route">
  <home-view data-route="home"></home-view>
  <connect-view data-route="connect"></connect-view>
  <market-view data-route="market"></market-view>
  <list-view data-route="list"></list-view>
  <countdown-view data-route="countdown"></countdown-view>
  <listing-view data-route="listing"></listing-view>
</custom-pages>
`
