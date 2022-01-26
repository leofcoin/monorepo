export default html`
<style>
  * {
    pointer-events: none;
  }
  .drawer {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 84px;
    left: 0;
    bottom: 84px;
    right: 0;
    width: 100%;
    opacity: 0;
    pointer-events: none;
    box-sizing: border-box;
    background: rgba(0,0,0,0.86);
    /* padding: 24px; */
    /* border-right: 1px solid var(--accent-color); */
    box-shadow: 1px 1px 18px 0px var(--accent-color);
    border-top-right-radius: 24px;
    border-bottom-right-radius: 24px;
  }

  aside header {
    box-shadow: -8px 3px 14px -4px var(--accent-color);
    border-bottom: 1px solid var(--accent-color);
  }

  .content {
    display: flex;
    flex-direction: column;
    padding: 12px 0;
    box-sizing: border-box;
  }

  aside a {
    display: flex;
    height: 60px;
    /* justify-content: center; */
    align-items: center;
    text-transform: uppercase;
    --svg-icon-color: #eee;
  }

  :host([open-drawer]) aside a {
    pointer-events: auto;
  }

  custom-svg-icon {
    padding: 0 6px;
  }

  [data-submenu] {
    padding-left: 48px;
    height: 0px;
    pointer-events: none;
    opacity: 0;
  }

  [shown] {
    height: 60px;
    pointer-events: auto;
    opacity: 1;
  }

  [shown] * {
    pointer-events: auto;
  }
</style>
<aside class="drawer">

  <span class="content">
    <a class="nav-item" data-menu="explore">
      <custom-svg-icon icon="explore"></custom-svg-icon>
      explore
      <flex-one></flex-one>
      <custom-svg-icon icon="arrow-drop-down"></custom-svg-icon>
    </a>
    <a href="#!/market" class="nav-item" data-submenu="explore">
      <custom-svg-icon icon="market"></custom-svg-icon>
      market
      <flex-one></flex-one>
    </a>

    <a href="#!/auctions" class="nav-item" data-submenu="explore">
      <custom-svg-icon icon="auctions"></custom-svg-icon>
      auctions
      <flex-one></flex-one>
    </a>

    <a href="#!/collections" class="nav-item" data-submenu="explore">
      <custom-svg-icon icon="collections"></custom-svg-icon>
      collections
      <flex-one></flex-one>
    </a>

    <a href="#!/list" class="nav-item">
      <custom-svg-icon icon="list"></custom-svg-icon>
      list
      <flex-one></flex-one>
    </a>

    <a href="#!/create" class="nav-item">
      <custom-svg-icon icon="create"></custom-svg-icon>
      create
      <flex-one></flex-one>
    </a>
  </span>
  <flex-one></flex-one>
  <span class="content">
    <a href="#!/creations" class="nav-item">
      <custom-svg-icon icon="photo-library"></custom-svg-icon>
      creations
      <flex-one></flex-one>
    </a>
    <a href="#!/wallet" class="nav-item">
      <custom-svg-icon icon="account-balance-wallet"></custom-svg-icon>
      wallet
      <flex-one></flex-one>
    </a>
    <a href="#!/account" class="nav-item">
      <custom-svg-icon icon="account"></custom-svg-icon>
      account
      <flex-one></flex-one>
    </a>
  </span>
  <footer>
  </footer>
</aside>
`
