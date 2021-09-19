module.exports = {
  staticFileGlobs: [
    'www/assets/**',
    '!www/service-worker.js',
    'www/*.js',
    'www/*.html'
  ],
  root: 'www',
  stripPrefix: 'www'
};
