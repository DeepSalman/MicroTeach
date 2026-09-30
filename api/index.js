// Vercel Serverless Function entry point
// Forwards incoming API requests to the Express backend app
const app = require('../back_end/server');

module.exports = (req, res) => {
  // If Vercel stripped the '/api' prefix, restore it for Express route matching
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
