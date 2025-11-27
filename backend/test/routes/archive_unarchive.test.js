const express = require('express');
const request = require('supertest');

function buildApp(repo) {
  const app = express();
  app.use((req, _res, next) => { req.currentUser = { id: 'user-1', roles: ['free'] }; next(); });
  app.post('/api/todos/:id/archive', async (req, res) => {
    await repo.archive(req.params.id);
    res.json({ id: req.params.id, archived: true });
  });
  app.post('/api/todos/:id/unarchive', async (req, res) => {
    await repo.unarchive(req.params.id);
    res.json({ id: req.params.id, archived: false });
  });
  return app;
}

describe('archive/unarchive routes', () => {
  it('archives and unarchives a todo', async () => {
    const actions = [];
    const repo = {
      archive: async (id) => actions.push(['archive', id]),
      unarchive: async (id) => actions.push(['unarchive', id]),
    };
    const app = buildApp(repo);
    await request(app).post('/api/todos/abc/archive').expect(200);
    await request(app).post('/api/todos/abc/unarchive').expect(200);
    expect(actions).toEqual([
      ['archive', 'abc'],
      ['unarchive', 'abc'],
    ]);
  });
});
