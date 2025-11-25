const swaggerUi = require('swagger-ui-express');
const baseSpec = require('../swagger.json');
const path = require('path');
const express = require('express');

module.exports = function (app) {
  // Serve the local SwaggerDark stylesheet from /swagger-ui
  app.use('/swagger-ui', express.static(path.join(__dirname, '..', 'public', 'swagger-ui')));

  // Serve a dynamic swagger.json that uses the current request host/protocol as server URL.
  app.get('/api-docs/swagger.json', (req, res) => {
    try {
      const spec = JSON.parse(JSON.stringify(baseSpec));
      const host = req.get('host');
      const protocol = req.protocol;
      spec.servers = [{ url: `${protocol}://${host}`, description: 'Auto-detected server' }];
      // Ensure we send clean JSON with proper content-type to avoid YAML parser issues in some clients
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(JSON.stringify(spec));
    } catch (e) {
      res.status(500).json({ error: 'Unable to load swagger spec' });
    }
  });

  // Serve Swagger UI at /api-docs and instruct it to fetch the spec from /api-docs/swagger.json
  // Use the local SwaggerDark stylesheet via `customCssUrl` so the UI is dark-themed.
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, {
    swaggerUrl: '/api-docs/swagger.json',
    customCssUrl: '/swagger-ui/SwaggerDark.css'
  }));
};
