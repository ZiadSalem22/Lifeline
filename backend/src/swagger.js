const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const baseSpec = require('../swagger.json');
const path = require('path');
const express = require('express');

module.exports = function (app) {
  // Serve the local SwaggerDark stylesheet from /swagger-ui
  app.use('/swagger-ui', express.static(path.join(__dirname, '..', 'public', 'swagger-ui')));

  // Serve a dynamic swagger.json from JSDoc annotations merged with base spec
  app.get('/api-docs/swagger.json', (req, res) => {
    try {
      const host = req.get('host');
      const protocol = req.protocol;

      const jsdocOptions = {
        definition: {
          openapi: baseSpec.openapi || '3.0.0',
          info: baseSpec.info,
          components: baseSpec.components || {},
          tags: baseSpec.tags || []
        },
        apis: [
          path.join(__dirname, '**/*.js'),
          path.join(__dirname, '..', 'src', '**/*.js')
        ]
      };

      const generated = swaggerJsdoc(jsdocOptions);
      // Merge base paths (static) with generated paths (from @openapi JSDoc)
      const spec = { ...generated };
      spec.paths = { ...(baseSpec.paths || {}), ...(generated.paths || {}) };
      // Ensure components exist and merge
      spec.components = { ...(baseSpec.components || {}), ...(generated.components || {}) };
      spec.components.securitySchemes = {
        ...(baseSpec.components && baseSpec.components.securitySchemes ? baseSpec.components.securitySchemes : {}),
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      };
      spec.servers = [{ url: `${protocol}://${host}`, description: 'Auto-detected server' }];
      // Apply global security so Swagger UI sends Bearer on all operations unless overridden
      spec.security = [{ bearerAuth: [] }];

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(JSON.stringify(spec));
    } catch (e) {
      res.status(500).json({ error: 'Unable to generate swagger spec', detail: e.message });
    }
  });

  // Serve Swagger UI at /api-docs and instruct it to fetch the spec from /api-docs/swagger.json
  // Use the local SwaggerDark stylesheet via `customCssUrl` so the UI is dark-themed.
  // Enable auth persistence and auto-apply Bearer token from localStorage ('lifeline_api_token').
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, {
    swaggerUrl: '/api-docs/swagger.json',
    customCssUrl: '/swagger-ui/SwaggerDark.css',
    swaggerOptions: {
      persistAuthorization: true,
      requestInterceptor: function (req) {
        try {
          var ls = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null;
          if (ls) {
            var stored = ls.getItem('lifeline_api_token');
            if (!req.headers) req.headers = {};
            // If Swagger UI already added Authorization, cache it to localStorage
            if (req.headers.Authorization && typeof req.headers.Authorization === 'string') {
              var token = req.headers.Authorization.replace(/^Bearer\s+/i, '');
              if (token) ls.setItem('lifeline_api_token', token);
            } else if (stored) {
              // If no header present, but we have a stored token, apply it
              req.headers.Authorization = 'Bearer ' + stored;
            }
          }
        } catch (e) { /* ignore storage errors */ }
        return req;
      }
    }
  }));
};
