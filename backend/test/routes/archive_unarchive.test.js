const express = require('express');
const request = require('supertest');

function buildApp(repo) {
  const app = express();
  app.use((req, _res, next) => { req.currentUser = { id: 'user-1', roles: ['free'] }; next(); });
  app.post('/api/todos/:id/archive', async (req, res) => {
    await repo.archive(req.params.id, req.currentUser.id);
    res.json({ id: req.params.id, archived: true });
  });
  app.post('/api/todos/:id/unarchive', async (req, res) => {
    await repo.unarchive(req.params.id, req.currentUser.id);
    res.json({ id: req.params.id, archived: false });
  });
  return app;
}

describe('archive/unarchive routes', () => {
  it('archives and unarchives a todo', async () => {
    const actions = [];
    const repo = {
      archive: async (id, userId) => actions.push(['archive', id, userId]),
      unarchive: async (id, userId) => actions.push(['unarchive', id, userId]),
    };
    const app = buildApp(repo);
    await request(app).post('/api/todos/abc/archive').expect(200);
    await request(app).post('/api/todos/abc/unarchive').expect(200);
    expect(actions).toEqual([
      ['archive', 'abc', 'user-1'],
      ['unarchive', 'abc', 'user-1'],
    ]);
  });
});
