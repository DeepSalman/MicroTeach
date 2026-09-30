// Vercel Serverless Function entry point
// Forwards incoming API requests to the Express backend app
const app = require('../back_end/server');

module.exports = app;
