import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp, registerUser } from './helpers';

describe('auth', () => {
  it('registers, rejects duplicates, and logs in', async () => {
    const { app } = makeApp();
    const reg = await request(app).post('/api/auth/register').send({ email: 'a@b.com', password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();
    expect(reg.body.user.passwordHash).toBeUndefined();

    const dup = await request(app).post('/api/auth/register').send({ email: 'A@b.com', password: 'password123' });
    expect(dup.status).toBe(409);

    const login = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it('gives the same error for wrong password and unknown email', async () => {
    const { app } = makeApp();
    await registerUser(app);
    const wrong = await request(app).post('/api/auth/login').send({ email: 'ali@example.com', password: 'wrongpass1' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'x@y.com', password: 'wrongpass1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('rejects invalid input with 400', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: '123' });
    expect(res.status).toBe(400);
  });

  it('protects private routes', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/api/batches')).status).toBe(401);
    expect((await request(app).get('/api/stats').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const { app } = makeApp();
    const token = await registerUser(app);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ali@example.com');
  });
});

describe('batches', () => {
  const texts = ['bohot acha product', 'packing kharab thi', 'order kal aya'];

  it('creates a batch, predicts and lists messages', async () => {
    const { app } = makeApp();
    const token = await registerUser(app);
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app).post('/api/batches').set(auth).send({ name: 'Test', texts });
    expect(created.status).toBe(201);
    expect(created.body.batch).toMatchObject({ total: 3, positive: 1, negative: 1, neutral: 1 });

    const id = created.body.batch.id;
    const list = await request(app).get(`/api/batches/${id}/messages`).set(auth);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(3);
    expect(list.body.items[0]).toMatchObject({ text: 'bohot acha product', predictedLabel: 'positive' });

    const onlyNeg = await request(app).get(`/api/batches/${id}/messages?label=negative`).set(auth);
    expect(onlyNeg.body.total).toBe(1);

    const all = await request(app).get('/api/batches').set(auth);
    expect(all.body.batches).toHaveLength(1);
  });

  it('paginates messages', async () => {
    const { app } = makeApp();
    const token = await registerUser(app);
    const auth = { Authorization: `Bearer ${token}` };
    const many = Array.from({ length: 25 }, (_, i) => `text ${i}`);
    const created = await request(app).post('/api/batches').set(auth).send({ name: 'Big', texts: many });
    const page2 = await request(app)
      .get(`/api/batches/${created.body.batch.id}/messages?page=2&pageSize=10`).set(auth);
    expect(page2.body.items).toHaveLength(10);
    expect(page2.body.total).toBe(25);
  });

  it('validates the request body', async () => {
    const { app } = makeApp();
    const token = await registerUser(app);
    const res = await request(app).post('/api/batches').set('Authorization', `Bearer ${token}`).send({ name: 'x', texts: [] });
    expect(res.status).toBe(400);
  });

  it('returns 502 when the model service is down and saves nothing', async () => {
    const { app, predictor } = makeApp();
    const token = await registerUser(app);
    const auth = { Authorization: `Bearer ${token}` };
    predictor.shouldFail = true;
    const res = await request(app).post('/api/batches').set(auth).send({ name: 'x', texts });
    expect(res.status).toBe(502);
    const list = await request(app).get('/api/batches').set(auth);
    expect(list.body.batches).toHaveLength(0);
  });

  it('does not let one user see another user\'s data', async () => {
    const { app } = makeApp();
    const alice = await registerUser(app, 'alice@example.com');
    const bob = await registerUser(app, 'bob@example.com');
    const created = await request(app).post('/api/batches').set('Authorization', `Bearer ${alice}`).send({ name: 'Private', texts });
    const id = created.body.batch.id;

    const bobBatches = await request(app).get('/api/batches').set('Authorization', `Bearer ${bob}`);
    expect(bobBatches.body.batches).toHaveLength(0);
    expect((await request(app).get(`/api/batches/${id}`).set('Authorization', `Bearer ${bob}`)).status).toBe(404);
    expect((await request(app).get(`/api/batches/${id}/messages`).set('Authorization', `Bearer ${bob}`)).status).toBe(404);
  });

  it('rejects malformed ids and malformed JSON', async () => {
    const { app } = makeApp();
    const token = await registerUser(app);
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).get('/api/batches/abc').set(auth)).status).toBe(400);
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{broken');
    expect(bad.status).toBe(400);
  });
});

describe('corrections and stats', () => {
  it('lets the owner correct a label and updates stats', async () => {
    const { app } = makeApp();
    const token = await registerUser(app);
    const auth = { Authorization: `Bearer ${token}` };
    const created = await request(app).post('/api/batches').set(auth).send({ name: 'S', texts: ['order kal aya', 'bohot acha'] });
    const id = created.body.batch.id;
    const msgs = await request(app).get(`/api/batches/${id}/messages`).set(auth);
    const neutralMsg = msgs.body.items.find((m: { predictedLabel: string }) => m.predictedLabel === 'neutral');

    const fix = await request(app).patch(`/api/messages/${neutralMsg.id}`).set(auth).send({ correctedLabel: 'negative' });
    expect(fix.status).toBe(200);

    const stats = await request(app).get('/api/stats').set(auth);
    expect(stats.body.stats).toMatchObject({ total: 2, negative: 1, positive: 1, neutral: 0, corrected: 1 });
  });

  it('blocks corrections of other users\' messages and invalid labels', async () => {
    const { app } = makeApp();
    const alice = await registerUser(app, 'alice@example.com');
    const bob = await registerUser(app, 'bob@example.com');
    const created = await request(app).post('/api/batches').set('Authorization', `Bearer ${alice}`).send({ name: 'S', texts: ['x'] });
    const msgs = await request(app).get(`/api/batches/${created.body.batch.id}/messages`).set('Authorization', `Bearer ${alice}`);
    const msgId = msgs.body.items[0].id;

    const hijack = await request(app).patch(`/api/messages/${msgId}`).set('Authorization', `Bearer ${bob}`).send({ correctedLabel: 'positive' });
    expect(hijack.status).toBe(404);
    const invalid = await request(app).patch(`/api/messages/${msgId}`).set('Authorization', `Bearer ${alice}`).send({ correctedLabel: 'happy' });
    expect(invalid.status).toBe(400);
  });
});
