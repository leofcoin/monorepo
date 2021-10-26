module.exports = {
  staticFileGlobs: [
    'www/assets/**',
    '!www/service-worker.js',
    'www/*.js',
    'www/lib/*.js',
    'www/*.html'
  ],
  root: 'www',
  stripPrefix: 'www'
};
