import './../node_modules/datastore-level/cjs/src/index.js'
import './../node_modules/interface-datastore/cjs/src/key.js'
import { version } from './../package.json'

globalThis.ArtOnlineStorage = new exports.LevelDatastore('artonline-exchange');

(async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', {
      scope: './'
    }).then(registration => {
      console.log('sw registration:', registration);

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;

        registration.installing.addEventListener('statechange', async () => {
          if (worker.state == 'activated') {
            // if (navigator.serviceWorker.controller) {
            // }
          } else if (worker.state == 'installed' && navigator.serviceWorker.controller) {
            let activeVersion = await ArtOnlineStorage.get(new exports.Key('active-version'));
            activeVersion = activeVersion.toString()
            if (activeVersion &&
              semver.parse(activeVersion).major !== semver.parse(version).major) {
                await prompt('Update available, press ok to reload!')
                location.reload()
              // document.getElementById('update').innerHTML =
              //   'Update available! reload!';
            }
          }
        });
      });
      if (typeof registration.update == 'function') {
        registration.update();
      }
    });
  }
})()
