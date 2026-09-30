// Vercel Serverless Function entry point (catch-all for /api/*)
// Forwards incoming API requests to the Express backend app
const app = require('../back_end/server');

module.exports = (req, res) => {
  // Extract true path requested by client
  let targetUrl = req.url || '/';

  // If Vercel rewrote the path to the function filename
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
  if (matchedPath && (targetUrl.includes('index.js') || targetUrl.includes('[...all]') || targetUrl === '/api' || targetUrl === '/api/')) {
    targetUrl = matchedPath;
  } else if (req.originalUrl && (targetUrl.includes('index.js') || targetUrl.includes('[...all]'))) {
    targetUrl = req.originalUrl;
  }

  // Preserve query string if not already present
  if (req.url && req.url.includes('?') && !targetUrl.includes('?')) {
    targetUrl += req.url.substring(req.url.indexOf('?'));
  }

  req.url = targetUrl;
  return app(req, res);
};
