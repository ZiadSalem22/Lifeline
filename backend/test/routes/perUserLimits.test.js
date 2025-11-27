const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');
const { AppError } = require('../../src/utils/errors');

function buildApp(todoRepo, tagRepo) {
  const app = express();
  app.use(bodyParser.json());
  app.use((req, _res, next) => { req.currentUser = { id: 'user-free', role: 'free' }; next(); });
  app.post('/api/todos', async (req, res) => {
    const count = await todoRepo.countByUser(req.currentUser.id);
    if (count >= 200) return res.status(403).json({ error: 'Free tier max tasks reached.' });
    res.status(201).json({ ok: true });
  });
  app.post('/api/tags', async (req, res) => {
    const count = await tagRepo.countByUser(req.currentUser.id);
    if (count >= 50) return res.status(403).json({ error: 'Free tier max tags reached.' });
    res.status(201).json({ ok: true });
  });
  app.delete('/api/todos/:id', async (req, res) => {
    const todo = await todoRepo.findById(req.params.id, req.currentUser.id);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    await todoRepo.delete(req.params.id, req.currentUser.id);
    res.status(204).send();
  });
  return app;
}

describe('Per-user limits and scoping (route simulation)', () => {
  it('allows task creation under limit and blocks at limit', async () => {
    const todoRepo = {
      countByUser: jest.fn()
        .mockResolvedValueOnce(199) // first request
        .mockResolvedValueOnce(200), // second
    };
    const tagRepo = { countByUser: jest.fn().mockResolvedValue(0) };
    const app = buildApp(todoRepo, tagRepo);
    await request(app).post('/api/todos').send({ title: 'A' }).expect(201);
    await request(app).post('/api/todos').send({ title: 'B' }).expect(403);
  });

  it('allows tag creation under limit and blocks at limit', async () => {
    const todoRepo = { countByUser: jest.fn().mockResolvedValue(0) };
    const tagRepo = {
      countByUser: jest.fn()
        .mockResolvedValueOnce(49)
        .mockResolvedValueOnce(50),
    };
    const app = buildApp(todoRepo, tagRepo);
    await request(app).post('/api/tags').send({ name: 'T', color: '#FFFFFF' }).expect(201);
    await request(app).post('/api/tags').send({ name: 'T2', color: '#000000' }).expect(403);
  });
});
