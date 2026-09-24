import request from 'supertest';
import { API, app, createUser, setupTestDatabase } from './helpers';

setupTestDatabase();

describe('application', () => {
  it('answers unknown routes with 404 JSON', async () => {
    await request(app).get(`${API}/does-not-exist`).expect(404, { message: 'Not found' });
  });

  it('answers malformed JSON with 400', async () => {
    const alice = await createUser('alice');
    await request(app)
      .post(`${API}/chats`)
      .set('Cookie', alice.cookie)
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400);
  });

  it('does not enable CORS by default', async () => {
    const response = await request(app).get('/health').set('Origin', 'https://evil.example.com').expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sends a restrictive content security policy', async () => {
    const response = await request(app).get('/').expect(200);
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['content-security-policy']).toContain("script-src-attr 'none'");
  });

  it('serves the frontend and the API documentation', async () => {
    await request(app).get('/script.js').expect(200);
    const docs = await request(app).get('/api-docs/swagger-ui-init.js').expect(200);
    expect(docs.text).toContain('/auth/login');
  });
});
