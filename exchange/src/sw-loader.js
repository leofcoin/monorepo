import './../node_modules/datastore-level/cjs/src/index.js'
import './../node_modules/interface-datastore/cjs/src/key.js'
import { version } from './../package.json'

globalThis.ArtOnlineStorage = new exports.LevelDatastore('artonline-exchange');
const compareVersion = async activeVersion => {
  console.log('activeVersion:', activeVersion, 'new version:', version);
  const parsedVersion = version.split('.')
  const parsedActiveVersion = activeVersion.split('.')
  return parsedVersion[0] === parsedActiveVersion[0] &&
         parsedVersion[1] === parsedActiveVersion[1] &&
         parsedVersion[2] === parsedActiveVersion[2]
};

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
            await ArtOnlineStorage.open()
            let activeVersion = await ArtOnlineStorage.get(new exports.Key('active-version'));
            activeVersion = activeVersion.toString()
            if (activeVersion && compareVersion(activeVersion)) {
                await confirm('Update available, press ok to reload!')
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
