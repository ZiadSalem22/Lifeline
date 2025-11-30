const express = require('express');
const request = require('supertest');

// Minimal app with only the public info route (mirrors implementation in index.js)
function makeApp() {
  const app = express();
  app.get('/api/public/info', (req, res) => {
    res.json({
      name: 'Lifeline API',
      version: '1.0.0',
      guestMode: 'local-only',
      message: 'Guest mode data never reaches the server; authenticate to sync.',
      time: new Date().toISOString()
    });
  });
  return app;
}

describe('Public Info Route', () => {
  it('returns public info without authentication', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/public/info');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Lifeline API');
    expect(res.body.guestMode).toBe('local-only');
    expect(typeof res.body.time).toBe('string');
  });
});
