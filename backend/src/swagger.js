const swaggerUi = require('swagger-ui-express');
const baseSpec = require('../swagger.json');

module.exports = function (app) {
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
  // Provide a light-weight dark theme via `customCss` so the UI uses dark colors in dev and prod.
  const darkCss = `
  /* Swagger UI Dark Theme (lightweight overrides) */
  html, body { background: #0b1220 !important; color: #cbd5e1 !important; }
  .swagger-ui .topbar { background: #071022 !important; }
  .swagger-ui .topbar a, .swagger-ui .topbar .download-url-wrapper { color: #cbd5e1 !important; }
  .swagger-ui .info, .swagger-ui .info .title { color: #e2e8f0 !important; }
  .swagger-ui .opblock { background: #071022 !important; border-color: #111827 !important; }
  .swagger-ui .opblock .opblock-summary { background: #0b1220 !important; border-color: #111827 !important; }
  .swagger-ui .opblock .opblock-summary-method { color: #cbd5e1 !important; }
  .swagger-ui .opblock-description-wrapper, .swagger-ui .opblock-body, .swagger-ui .responses-inner, .swagger-ui .renderedMarkdown { color: #cbd5e1 !important; }
  .swagger-ui .parameter__name { color: #cbd5e1 !important; }
  .swagger-ui .btn, .swagger-ui .try-out, .swagger-ui .execute { background: #0f1724 !important; color: #cbd5e1 !important; border-color: #1f2937 !important; }
  .swagger-ui .response-col_status, .swagger-ui .response-col_description { color: #cbd5e1 !important; }
  .swagger-ui select, .swagger-ui textarea, .swagger-ui input { background: #0b1220 !important; color: #cbd5e1 !important; border-color: #1f2937 !important; }
  a { color: #60a5fa !important; }
  `;

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, { swaggerUrl: '/api-docs/swagger.json', customCss: darkCss }));
};
