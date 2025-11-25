const swaggerUi = require('swagger-ui-express');
const baseSpec = require('../swagger.json');

module.exports = function (app) {
  // Serve Swagger UI at /api-docs and instruct it to fetch the spec from /api-docs/swagger.json
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, { swaggerUrl: '/api-docs/swagger.json' }));

  // Serve a dynamic swagger.json that uses the current request host/protocol as server URL.
  app.get('/api-docs/swagger.json', (req, res) => {
    try {
      const spec = JSON.parse(JSON.stringify(baseSpec));
      const host = req.get('host');
      const protocol = req.protocol;
      spec.servers = [{ url: `${protocol}://${host}`, description: 'Auto-detected server' }];
      res.json(spec);
    } catch (e) {
      res.status(500).json({ error: 'Unable to load swagger spec' });
    }
  });
};
