const { createNodeMiddleware, createProbot } = require("probot");

const app = require("../../../src/index.ts");
const probot = createProbot();

module.exports = createNodeMiddleware(app, { probot, webhooksPath: '/api/github/webhooks' });