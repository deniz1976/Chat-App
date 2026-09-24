import request from 'supertest';
import { API, app, createUser, extractAuthCookie, setupTestDatabase } from './helpers';

setupTestDatabase();

const register = (overrides: Record<string, string> = {}) =>
  request(app)
    .post(`${API}/auth/register`)
    .send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
      ...overrides,
    });

describe('authentication', () => {
  it('registers a user and issues an httpOnly SameSite=Strict cookie instead of a token in the body', async () => {
    const response = await register().expect(201);

    expect(response.body.token).toBeUndefined();
    expect(response.body.user).toMatchObject({ username: 'alice', email: 'alice@example.com', role: 'user' });
    expect(response.body.user.password).toBeUndefined();

    const cookie = ([] as string[]).concat(response.headers['set-cookie'])[0];
    expect(cookie).toMatch(/^access_token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  it('rejects duplicate usernames and emails with 409', async () => {
    await register().expect(201);
    await register({ email: 'other@example.com' }).expect(409);
    await register({ username: 'other' }).expect(409);
  });

  it('answers concurrent registrations of the same username with a single success', async () => {
    const statuses = await Promise.all(
      [1, 2, 3, 4].map((i) => register({ email: `race${i}@example.com` }).then((r) => r.status)),
    );
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(3);
  });

  it('rejects registration fields outside the schema', async () => {
    await register({ role: 'admin' }).expect(400);
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    await register().expect(201);
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'alice@example.com', password: 'secret123' })
      .expect(200);
    expect(extractAuthCookie(response)).toMatch(/^access_token=/);

    const failure = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'alice@example.com', password: 'wrong-password' })
      .expect(401);
    expect(failure.body.message).toBe('Invalid email or password');

    await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'nobody@example.com', password: 'secret123' })
      .expect(401);
  });

  it('authenticates only through the cookie', async () => {
    const alice = await createUser('alice');
    const token = alice.cookie.split('=')[1];

    await request(app).get(`${API}/users/profile`).expect(401);
    await request(app).get(`${API}/users/profile`).set('Authorization', `Bearer ${token}`).expect(401);
    await alice.get('/users/profile').expect(200);
  });

  it('rejects tokens of deleted users', async () => {
    const alice = await createUser('alice');
    await alice.delete(`/users/${alice.id}`).expect(204);
    await alice.get('/users/profile').expect(401);
  });

  it('refreshes the session cookie only for authenticated users', async () => {
    const alice = await createUser('alice');
    const response = await alice.post('/auth/refresh-token').expect(200);
    expect(extractAuthCookie(response)).toMatch(/^access_token=/);
    await request(app).post(`${API}/auth/refresh-token`).expect(401);
  });

  it('clears the cookie on logout even without a session', async () => {
    const response = await request(app).post(`${API}/auth/logout`).expect(200);
    const cookie = ([] as string[]).concat(response.headers['set-cookie'])[0];
    expect(cookie).toMatch(/^access_token=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
