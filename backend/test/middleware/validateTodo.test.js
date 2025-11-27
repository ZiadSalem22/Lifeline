const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const { validateTodoCreate, validateTodoUpdate } = require('../../src/middleware/validateTodo');

function appWith(mw) {
  const app = express();
  app.use(bodyParser.json());
  app.post('/create', mw, (req, res) => res.json({ ok: true }));
  return app;
}

describe('validateTodo middleware', () => {
  it('rejects missing title on create', async () => {
    const app = appWith(validateTodoCreate);
    const res = await request(app).post('/create').send({}).expect(400);
    expect(res.body.error || res.text).toBeDefined();
  });

  it('accepts valid minimal payload', async () => {
    const app = appWith(validateTodoCreate);
    await request(app).post('/create').send({ title: 'Do it', dueDate: null }).expect(200);
  });

  it('rejects too-long title', async () => {
    const app = appWith(validateTodoCreate);
    const long = 'x'.repeat(201);
    await request(app).post('/create').send({ title: long }).expect(400);
  });

  it('allows update without title but validates lengths', async () => {
    const app = appWith(validateTodoUpdate);
    await request(app).post('/create').send({ description: 'x'.repeat(2001) }).expect(400);
  });
});
