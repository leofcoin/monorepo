import './../../node_modules/custom-selector/src/index'

export default html`
<header center>
  <a href="#!/home" center class="logo">
    <img src="https://assets.artonline.site/arteon.svg"></img>
    <h2>ArtExchange</h2>
  </a>
  <flex-one></flex-one>
  <search-element class="desktop"></search-element>
  <flex-one></flex-one>
  <custom-selector class="nav-bar">
    <a href="#!/market" class="nav-item">
      market
    </a>
  </custom-selector>
  <!-- <a href="#!/wallet" class="nav-item">
    wallet
  </a> -->
  <canvas class="avatar"></canvas>
</header>
<flex-row class="mobile-search">
  <flex-one></flex-one>
  <search-element class="mobile"></search-element>
  <flex-one></flex-one>
</flex-row>
`
