import { version } from './../package.json'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', {
    scope: './'
  }).then(registration => {
    console.log('sw registration:', registration);

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;

      registration.installing.addEventListener('statechange', () => {
        if (worker.state == 'activated') {
          // if (navigator.serviceWorker.controller) {
          // }
        } else if (worker.state == 'installed' && navigator.serviceWorker.controller) {
          const activeVersion = localStorage.getItem('active-version')
          if (activeVersion &&
            semver.parse(activeVersion).major !== semver.parse(version).major) {
            document.getElementById('update').innerHTML =
              'Update available! reload!';
          }
        }
      });
    });
    if (typeof registration.update == 'function') {
      registration.update();
    }
  });
}
