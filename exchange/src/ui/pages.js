import './../../node_modules/custom-pages/src/custom-pages'

export default html`
<custom-pages attr-for-selected="data-route">
  <home-view data-route="home"></home-view>
  <connect-view data-route="connect"></connect-view>
  <market-view data-route="market"></market-view>
  <list-view data-route="list"></list-view>
  <countdown-view data-route="countdown"></countdown-view>
  <listing-view data-route="listing"></listing-view>
  <collections-view data-route="collections"></collections-view>
  <auctions-view data-route="auctions"></auctions-view>
  <create-view data-route="create"></create-view>
  <account-view data-route="account"></account-view>
  <wallet-view data-route="wallet"></wallet-view>
</custom-pages>
`
