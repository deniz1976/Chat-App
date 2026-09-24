import { createDirectChat, createUser, setupTestDatabase, TestUser } from './helpers';

setupTestDatabase();

describe('messages', () => {
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let chatId: string;

  const send = async (sender: TestUser, content: string, extra: object = {}) =>
    (await sender.post('/messages', { chatId, content, ...extra }).expect(201)).body;

  beforeEach(async () => {
    [alice, bob, carol] = await Promise.all(['alice', 'bob', 'carol'].map(createUser));
    chatId = await createDirectChat(alice, bob);
  });

  it('pages newest first with a cursor and returns each page in chronological order', async () => {
    for (let i = 1; i <= 5; i++) {
      await send(alice, `m${i}`);
    }

    const first = await alice.get(`/messages/chat/${chatId}?limit=2`).expect(200);
    expect(first.body.map((m: { content: string }) => m.content)).toEqual(['m4', 'm5']);

    const second = await alice.get(`/messages/chat/${chatId}?limit=2&before=${first.body[0].id}`).expect(200);
    expect(second.body.map((m: { content: string }) => m.content)).toEqual(['m2', 'm3']);

    const third = await alice.get(`/messages/chat/${chatId}?limit=2&before=${second.body[0].id}`).expect(200);
    expect(third.body.map((m: { content: string }) => m.content)).toEqual(['m1']);

    await alice.get(`/messages/chat/${chatId}?limit=101`).expect(400);
    await alice.get(`/messages/chat/${chatId}?before=11111111-1111-4111-8111-111111111111`).expect(400);
  });

  it('updates the chat last message', async () => {
    const message = await send(bob, 'latest');
    const chat = await alice.get(`/chats/${chatId}`).expect(200);
    expect(chat.body.lastMessage.id).toBe(message.id);
    expect(chat.body.lastMessage.senderId).toBe(bob.id);
    expect(chat.body.lastMessage.content).toBe('latest');
  });

  it('restricts access to participants', async () => {
    const message = await send(alice, 'private');

    await carol.post('/messages', { chatId, content: 'intrusion' }).expect(403);
    await carol.get(`/messages/chat/${chatId}`).expect(403);
    await carol.get(`/messages/${message.id}`).expect(403);
    await carol.put(`/messages/${message.id}/read`).expect(403);
    await carol.get(`/messages/chat/${chatId}/search?q=private`).expect(403);
  });

  it('rejects replies to messages of other chats', async () => {
    const dave = await createUser('dave');
    const otherChatId = await createDirectChat(carol, dave);
    const foreign = (await carol.post('/messages', { chatId: otherChatId, content: 'elsewhere' }).expect(201)).body;
    const local = await send(alice, 'here');

    await alice.post('/messages', { chatId, content: 'reply', replyToId: foreign.id }).expect(400);
    await alice.post('/messages', { chatId, content: 'reply', replyToId: local.id }).expect(201);
  });

  it('accepts only https media URLs', async () => {
    await alice.post('/messages', { chatId, content: 'x', type: 'image', mediaUrl: 'javascript:alert(1)' }).expect(400);
    await alice
      .post('/messages', { chatId, content: 'x', type: 'image', mediaUrl: 'https://cdn.example.com/a.png' })
      .expect(201);
  });

  it('lets only the sender edit and delete a message', async () => {
    const message = await send(alice, 'original');

    await bob.put(`/messages/${message.id}`, { content: 'forged' }).expect(404);
    await alice.put(`/messages/${message.id}`, {}).expect(400);
    expect((await alice.put(`/messages/${message.id}`, { content: 'edited' }).expect(200)).body.content).toBe('edited');

    await bob.delete(`/messages/${message.id}`).expect(404);
    await alice.delete(`/messages/${message.id}`).expect(204);
    await alice.get(`/messages/${message.id}`).expect(404);
  });

  it('moves the chat last message back when the last message is deleted', async () => {
    const first = await send(alice, 'first');
    const second = await send(bob, 'second');

    await alice.delete(`/messages/${first.id}`).expect(204);
    expect((await alice.get(`/chats/${chatId}`)).body.lastMessage.id).toBe(second.id);

    await bob.delete(`/messages/${second.id}`).expect(204);
    const chat = await alice.get(`/chats/${chatId}`).expect(200);
    expect(chat.body.lastMessage).toBeNull();
  });

  it('tracks unread messages and read receipts idempotently', async () => {
    const first = await send(alice, 'one');
    await send(alice, 'two');

    expect((await bob.get(`/messages/chat/${chatId}/unread`).expect(200)).body.unreadCount).toBe(2);
    await bob.put(`/messages/${first.id}/read`).expect(200);
    await bob.put(`/messages/${first.id}/read`).expect(200);
    expect((await bob.get(`/messages/chat/${chatId}/unread`).expect(200)).body.unreadCount).toBe(1);

    const stored = await alice.get(`/messages/${first.id}`).expect(200);
    expect(stored.body.readBy).toEqual([alice.id, bob.id]);
  });

  it('marks every unread message of a chat as read at once', async () => {
    const first = await send(alice, 'one');
    const second = await send(alice, 'two');
    await send(bob, 'mine');

    const response = await bob.post(`/chats/${chatId}/read`).expect(200);
    expect(response.body.messageIds.sort()).toEqual([first.id, second.id].sort());
    expect((await bob.get(`/messages/chat/${chatId}/unread`)).body.unreadCount).toBe(0);
    expect((await bob.post(`/chats/${chatId}/read`).expect(200)).body.messageIds).toEqual([]);
    await carol.post(`/chats/${chatId}/read`).expect(403);
  });

  it('searches content with escaped LIKE wildcards', async () => {
    await send(alice, '100% done');
    await send(alice, 'nothing here');

    const percent = await alice.get(`/messages/chat/${chatId}/search?q=%25`).expect(200);
    expect(percent.body.map((m: { content: string }) => m.content)).toEqual(['100% done']);
    expect((await alice.get(`/messages/chat/${chatId}/search?q=_`).expect(200)).body).toHaveLength(0);
    await alice.get(`/messages/chat/${chatId}/search`).expect(400);
  });
});
