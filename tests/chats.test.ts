import { sequelize } from '../src/infrastructure/database';
import { createDirectChat, createUser, setupTestDatabase, TestUser } from './helpers';

setupTestDatabase();

const countDirectChats = async (): Promise<number> => {
  const [rows] = await sequelize.query(
    "SELECT count(*)::int AS count FROM chats WHERE type = 'direct' AND deleted_at IS NULL",
  );
  return (rows as Array<{ count: number }>)[0].count;
};

describe('direct chats', () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeEach(async () => {
    alice = await createUser('alice');
    bob = await createUser('bob');
  });

  it('returns the existing chat regardless of who starts it', async () => {
    const created = await alice.post('/chats', { type: 'direct', participants: [bob.id] }).expect(201);
    const existing = await bob.post('/chats', { type: 'direct', participants: [alice.id] }).expect(200);
    expect(existing.body.id).toBe(created.body.id);
  });

  it('creates a single chat for concurrent requests', async () => {
    await Promise.all([
      alice.post('/chats', { type: 'direct', participants: [bob.id] }),
      bob.post('/chats', { type: 'direct', participants: [alice.id] }),
      alice.post('/chats', { type: 'direct', participants: [bob.id] }),
      bob.post('/chats', { type: 'direct', participants: [alice.id] }),
    ]);
    expect(await countDirectChats()).toBe(1);
  });

  it('allows starting a new chat after the previous one was deleted', async () => {
    const chatId = await createDirectChat(alice, bob);
    await alice.delete(`/chats/${chatId}`).expect(204);
    await bob.post('/chats', { type: 'direct', participants: [alice.id] }).expect(201);
  });

  it('lists chats with member profiles and per-user unread counts', async () => {
    const chatId = await createDirectChat(alice, bob);
    await alice.post('/messages', { chatId, content: 'one' }).expect(201);
    await alice.post('/messages', { chatId, content: 'two' }).expect(201);

    const [chat] = (await bob.get('/chats').expect(200)).body;
    expect(chat.unreadCount).toBe(2);
    expect(chat.lastMessage).toMatchObject({ content: 'two', senderId: alice.id });
    expect(chat.members.map((m: { username: string }) => m.username).sort()).toEqual(['alice', 'bob']);
    expect(chat.members[0]).not.toHaveProperty('email');
    expect(chat).not.toHaveProperty('directKey');

    expect((await alice.get('/chats').expect(200)).body[0].unreadCount).toBe(0);
  });

  it('rejects chats with yourself and with unknown users', async () => {
    await alice.post('/chats', { type: 'direct', participants: [alice.id] }).expect(400);
    await alice.post('/chats', { type: 'direct', participants: ['11111111-1111-4111-8111-111111111111'] }).expect(404);
  });

  it('hides chats from non-participants and forbids updating direct chats', async () => {
    const carol = await createUser('carol');
    const chatId = await createDirectChat(alice, bob);

    await carol.get(`/chats/${chatId}`).expect(403);
    await alice.put(`/chats/${chatId}`, { name: 'renamed' }).expect(403);
    expect((await carol.get('/chats').expect(200)).body).toHaveLength(0);
  });
});

describe('group chats', () => {
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let dave: TestUser;
  let groupId: string;

  beforeEach(async () => {
    [alice, bob, carol, dave] = await Promise.all(['alice', 'bob', 'carol', 'dave'].map(createUser));
    const response = await alice
      .post('/chats', { type: 'group', name: 'team', participants: [bob.id, carol.id] })
      .expect(201);
    groupId = response.body.id;
  });

  it('requires a name', async () => {
    await alice.post('/chats', { type: 'group', participants: [bob.id] }).expect(400);
  });

  it('lets admins add participants who exist and are not members yet', async () => {
    await bob.post(`/chats/${groupId}/participants`, { userId: dave.id }).expect(403);
    const added = await alice.post(`/chats/${groupId}/participants`, { userId: dave.id }).expect(200);
    expect(added.body.participants).toContain(dave.id);
    await alice.post(`/chats/${groupId}/participants`, { userId: dave.id }).expect(409);
    await alice.post(`/chats/${groupId}/participants`, { userId: '11111111-1111-4111-8111-111111111111' }).expect(404);
    await alice.post(`/chats/${groupId}/participants`, {}).expect(400);
  });

  it('keeps every participant when admins add users concurrently', async () => {
    const eve = await createUser('eve');
    await Promise.all([
      alice.post(`/chats/${groupId}/participants`, { userId: dave.id }),
      alice.post(`/chats/${groupId}/participants`, { userId: eve.id }),
    ]);
    const chat = await alice.get(`/chats/${groupId}`).expect(200);
    expect(chat.body.participants).toEqual(expect.arrayContaining([alice.id, bob.id, carol.id, dave.id, eve.id]));
  });

  it('removes participants but never the creator', async () => {
    await alice.post(`/chats/${groupId}/admins`, { userId: bob.id }).expect(200);

    await bob.delete(`/chats/${groupId}/participants/${alice.id}`).expect(400);
    const removed = await bob.delete(`/chats/${groupId}/participants/${carol.id}`).expect(200);
    expect(removed.body.participants).not.toContain(carol.id);
    await bob.delete(`/chats/${groupId}/participants/${carol.id}`).expect(404);
    await bob.delete(`/chats/${groupId}/participants/${bob.id}`).expect(400);
  });

  it('manages admins', async () => {
    await alice.post(`/chats/${groupId}/admins`, { userId: dave.id }).expect(400);
    await alice.post(`/chats/${groupId}/admins`, { userId: bob.id }).expect(200);
    await alice.post(`/chats/${groupId}/admins`, { userId: bob.id }).expect(409);
    await bob.delete(`/chats/${groupId}/admins/${alice.id}`).expect(400);
    const removed = await alice.delete(`/chats/${groupId}/admins/${bob.id}`).expect(200);
    expect(removed.body.admins).toEqual([alice.id]);
    await carol.post(`/chats/${groupId}/admins`, { userId: carol.id }).expect(403);
  });

  it('lets members leave but not the creator', async () => {
    await carol.post(`/chats/${groupId}/leave`).expect(204);
    await carol.get(`/chats/${groupId}`).expect(403);
    await alice.post(`/chats/${groupId}/leave`).expect(400);
    await dave.post(`/chats/${groupId}/leave`).expect(404);
  });

  it('lets only admins rename and only the creator delete', async () => {
    await bob.put(`/chats/${groupId}`, { name: 'hijacked' }).expect(403);
    expect((await alice.put(`/chats/${groupId}`, { name: 'renamed' }).expect(200)).body.name).toBe('renamed');
    await alice.put(`/chats/${groupId}`, {}).expect(400);
    await bob.delete(`/chats/${groupId}`).expect(403);
    await alice.delete(`/chats/${groupId}`).expect(204);
  });

  it('validates route parameters', async () => {
    await alice.get('/chats/not-a-uuid').expect(400);
    await alice.delete(`/chats/${groupId}/participants/not-a-uuid`).expect(400);
  });
});
