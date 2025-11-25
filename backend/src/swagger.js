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
  // Use a popular Swagger UI dark theme served from a CDN via `customCssUrl`.
  // This is the widely used 'swagger-ui-themes' dark stylesheet for Swagger UI v3.
  // Apply the SwaggerDark theme from the Amoenus/SwaggerDark repo via jsDelivr CDN
  // Using @import inside customCss is generally reliable across hosting setups.
  const importDarkCss = `@import url('https://cdn.jsdelivr.net/gh/Amoenus/SwaggerDark@master/dist/swagger-dark.css');`;
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, {
    swaggerUrl: '/api-docs/swagger.json',
    customCss: importDarkCss
  }));
};
