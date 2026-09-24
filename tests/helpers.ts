import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { WebSocket } from 'ws';
import { createApp } from '../src/app';
import { sequelize, setupDatabase } from '../src/infrastructure/database';
import { initializeWebSocket } from '../src/api/websocket/server';

export const app = createApp();
export const API = '/api/v1';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  cookie: string;
  get(path: string): request.Test;
  post(path: string, body?: object): request.Test;
  put(path: string, body?: object): request.Test;
  delete(path: string): request.Test;
}

export const setupTestDatabase = (): void => {
  beforeAll(async () => {
    await setupDatabase();
  });

  beforeEach(async () => {
    await sequelize.query('TRUNCATE users, chats, messages CASCADE');
  });

  afterAll(async () => {
    await sequelize.close();
  });
};

export const extractAuthCookie = (response: request.Response): string => {
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const cookie = cookies.find((value) => value.startsWith('access_token='));
  if (!cookie) {
    throw new Error('Response did not set an auth cookie');
  }
  return cookie.split(';')[0];
};

export const asUser = (id: string, username: string, email: string, cookie: string): TestUser => ({
  id,
  username,
  email,
  cookie,
  get: (path) =>
    request(app)
      .get(API + path)
      .set('Cookie', cookie),
  post: (path, body) =>
    request(app)
      .post(API + path)
      .set('Cookie', cookie)
      .send(body),
  put: (path, body) =>
    request(app)
      .put(API + path)
      .set('Cookie', cookie)
      .send(body),
  delete: (path) =>
    request(app)
      .delete(API + path)
      .set('Cookie', cookie),
});

export const createUser = async (username: string): Promise<TestUser> => {
  const email = `${username}@example.com`;
  const response = await request(app)
    .post(`${API}/auth/register`)
    .send({ username, email, password: 'secret123', displayName: username })
    .expect(201);
  return asUser(response.body.user.id, username, email, extractAuthCookie(response));
};

export const makeAdmin = async (user: TestUser): Promise<void> => {
  await sequelize.query(`UPDATE users SET role = 'admin' WHERE id = '${user.id}'`);
};

export const createDirectChat = async (owner: TestUser, other: TestUser): Promise<string> => {
  const response = await owner.post('/chats', { type: 'direct', participants: [other.id] });
  return response.body.id;
};

export interface TestServer {
  url: string;
  origin: string;
  close(): Promise<void>;
}

export const startServer = async (): Promise<TestServer> => {
  const server = http.createServer(app);
  const wss = initializeWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `ws://localhost:${port}/ws`,
    origin: `http://localhost:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        wss.clients.forEach((client) => client.terminate());
        wss.close();
        server.close(() => resolve());
      }),
  };
};

export interface TestSocket {
  socket: WebSocket;
  events: Array<{ type: string; payload: any }>;
  send(message: unknown): void;
  waitFor(
    predicate: (event: { type: string; payload: any }) => boolean,
    timeoutMs?: number,
  ): Promise<{ type: string; payload: any }>;
  close(): Promise<void>;
}

export const connect = (server: TestServer, headers: Record<string, string>): Promise<TestSocket | number> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(server.url, { headers });
    const events: TestSocket['events'] = [];
    socket.on('message', (data) => events.push(JSON.parse(data.toString())));
    socket.on('unexpected-response', (req, res) => resolve(res.statusCode ?? 0));
    socket.on('error', reject);
    socket.on('open', () =>
      resolve({
        socket,
        events,
        send: (message) => socket.send(typeof message === 'string' ? message : JSON.stringify(message)),
        waitFor: (predicate, timeoutMs = 2000) =>
          new Promise((resolveEvent, rejectEvent) => {
            const started = Date.now();
            const poll = () => {
              const match = events.find(predicate);
              if (match) {
                resolveEvent(match);
              } else if (Date.now() - started > timeoutMs) {
                rejectEvent(new Error('Timed out waiting for WebSocket event'));
              } else {
                setTimeout(poll, 10);
              }
            };
            poll();
          }),
        close: () =>
          new Promise((resolveClose) => {
            socket.once('close', () => resolveClose());
            socket.close();
          }),
      }),
    );
  });

export const connectAs = async (server: TestServer, user: TestUser): Promise<TestSocket> => {
  const result = await connect(server, { Cookie: user.cookie, Origin: server.origin });
  if (typeof result === 'number') {
    throw new Error(`WebSocket connection rejected with ${result}`);
  }
  return result;
};

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
