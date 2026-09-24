import { sequelize } from '../src/infrastructure/database';
import {
  connect, connectAs, createDirectChat, createUser, setupTestDatabase, sleep, startServer, TestServer, TestUser,
} from './helpers';

setupTestDatabase();

const statusOf = async (user: TestUser): Promise<string> => {
  const [rows] = await sequelize.query(`SELECT status FROM users WHERE id = '${user.id}'`);
  return (rows as Array<{ status: string }>)[0].status;
};

const eventually = async (assertion: () => Promise<void>, timeoutMs = 2000): Promise<void> => {
  const started = Date.now();
  for (;;) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() - started > timeoutMs) {
        throw error;
      }
      await sleep(20);
    }
  }
};

describe('WebSocket', () => {
  let server: TestServer;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let chatId: string;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    [alice, bob, carol] = await Promise.all(['alice', 'bob', 'carol'].map(createUser));
    chatId = await createDirectChat(alice, bob);
  });

  afterEach(async () => {
    await eventually(async () => {
      const [rows] = await sequelize.query("SELECT count(*)::int AS count FROM users WHERE status = 'online'");
      expect((rows as Array<{ count: number }>)[0].count).toBe(0);
    });
  });

  describe('handshake', () => {
    it('requires the auth cookie', async () => {
      expect(await connect(server, { Origin: server.origin })).toBe(401);
      expect(await connect(server, { Origin: server.origin, Cookie: 'access_token=invalid' })).toBe(401);
    });

    it('rejects cross-origin and origin-less handshakes', async () => {
      expect(await connect(server, { Cookie: alice.cookie, Origin: 'https://evil.example.com' })).toBe(403);
      expect(await connect(server, { Cookie: alice.cookie })).toBe(403);
    });

    it('accepts same-origin handshakes with a valid cookie', async () => {
      const socket = await connectAs(server, alice);
      await socket.close();
    });
  });

  describe('events', () => {
    it('delivers new messages to every connection of each recipient', async () => {
      const bobTab1 = await connectAs(server, bob);
      const bobTab2 = await connectAs(server, bob);

      await alice.post('/messages', { chatId, content: 'hello' }).expect(201);
      await bobTab1.waitFor(e => e.type === 'NEW_MESSAGE' && e.payload.content === 'hello');
      await bobTab2.waitFor(e => e.type === 'NEW_MESSAGE' && e.payload.content === 'hello');

      await bobTab1.close();
      await alice.post('/messages', { chatId, content: 'still there' }).expect(201);
      await bobTab2.waitFor(e => e.type === 'NEW_MESSAGE' && e.payload.content === 'still there');
      await bobTab2.close();
    });

    it('relays typing only to participants and ignores client supplied recipients', async () => {
      const aliceSocket = await connectAs(server, alice);
      const carolSocket = await connectAs(server, carol);
      const bobSocket = await connectAs(server, bob);

      carolSocket.send({ type: 'TYPING', payload: { chatId, isTyping: true } });
      await carolSocket.waitFor(e => e.type === 'ERROR' && e.payload.message === 'You are not a participant in this chat');

      carolSocket.send({ type: 'TYPING', payload: { chatId, isTyping: true, participantIds: [alice.id] } });
      await carolSocket.waitFor(e => e.type === 'ERROR' && /participantIds/.test(e.payload.message));

      bobSocket.send({ type: 'TYPING', payload: { chatId, isTyping: true } });
      await aliceSocket.waitFor(e => e.type === 'TYPING' && e.payload.userId === bob.id);

      await sleep(100);
      expect(aliceSocket.events.filter(e => e.type === 'TYPING')).toHaveLength(1);
      await Promise.all([aliceSocket.close(), carolSocket.close(), bobSocket.close()]);
    });

    it('persists read receipts and notifies the other participants once', async () => {
      const message = (await alice.post('/messages', { chatId, content: 'read me' }).expect(201)).body;
      const aliceSocket = await connectAs(server, alice);
      const bobSocket = await connectAs(server, bob);

      bobSocket.send({ type: 'READ_RECEIPT', payload: { chatId, messageId: message.id } });
      bobSocket.send({ type: 'READ_RECEIPT', payload: { chatId, messageId: message.id } });
      await aliceSocket.waitFor(e => e.type === 'READ_RECEIPT' && e.payload.readerId === bob.id);
      await sleep(100);

      expect(aliceSocket.events.filter(e => e.type === 'READ_RECEIPT')).toHaveLength(1);
      expect((await alice.get(`/messages/${message.id}`)).body.readBy).toEqual([alice.id, bob.id]);
      await Promise.all([aliceSocket.close(), bobSocket.close()]);
    });

    it('rejects read receipts for messages of another chat', async () => {
      const otherChatId = await createDirectChat(bob, carol);
      const message = (await alice.post('/messages', { chatId, content: 'x' }).expect(201)).body;
      const bobSocket = await connectAs(server, bob);

      bobSocket.send({ type: 'READ_RECEIPT', payload: { chatId: otherChatId, messageId: message.id } });
      await bobSocket.waitFor(e => e.type === 'ERROR' && e.payload.message === 'Message not found in this chat');
      await bobSocket.close();
    });

    it('reports malformed and unsupported messages', async () => {
      const socket = await connectAs(server, alice);
      socket.send('not json');
      await socket.waitFor(e => e.type === 'ERROR' && e.payload.message === 'Invalid message format');
      socket.send({ type: 'UNKNOWN', payload: {} });
      await socket.waitFor(e => e.type === 'ERROR' && /Unsupported message type/.test(e.payload.message));
      await socket.close();
    });
  });

  describe('presence', () => {
    it('tracks status across connections and notifies only contacts', async () => {
      const bobSocket = await connectAs(server, bob);
      const carolSocket = await connectAs(server, carol);

      const aliceTab1 = await connectAs(server, alice);
      await bobSocket.waitFor(e => e.type === 'USER_STATUS' && e.payload.userId === alice.id && e.payload.status === 'online');
      await eventually(async () => expect(await statusOf(alice)).toBe('online'));

      const aliceTab2 = await connectAs(server, alice);
      await aliceTab1.close();
      await sleep(100);
      expect(await statusOf(alice)).toBe('online');

      await aliceTab2.close();
      await bobSocket.waitFor(e => e.type === 'USER_STATUS' && e.payload.userId === alice.id && e.payload.status === 'offline');
      await eventually(async () => expect(await statusOf(alice)).toBe('offline'));

      expect(carolSocket.events.filter(e => e.type === 'USER_STATUS' && e.payload.userId === alice.id)).toHaveLength(0);
      expect(bobSocket.events.filter(e => e.type === 'USER_STATUS' && e.payload.userId === alice.id)).toHaveLength(2);
      await Promise.all([bobSocket.close(), carolSocket.close()]);
    });

    it('broadcasts away status set through the API', async () => {
      const bobSocket = await connectAs(server, bob);
      await alice.put(`/users/${alice.id}/status`, { status: 'away' }).expect(200);
      await bobSocket.waitFor(e => e.type === 'USER_STATUS' && e.payload.status === 'away');
      await bobSocket.close();
    });
  });
});
