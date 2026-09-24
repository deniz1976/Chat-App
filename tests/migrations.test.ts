import { randomUUID } from 'crypto';
import { QueryTypes, Sequelize } from 'sequelize';
import { createMigrator } from '../src/infrastructure/database/migrator';
import { Chat } from '../src/domain/entities/Chat';
import { recreateDatabase } from './database';

const DATABASE = `${process.env.DB_NAME}_migrations`;

describe('migrations', () => {
  let sequelize: Sequelize;

  const select = <T extends object>(sql: string) => sequelize.query<T>(sql, { type: QueryTypes.SELECT });

  beforeEach(async () => {
    await recreateDatabase(DATABASE);
    sequelize = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      database: DATABASE,
      logging: false,
      define: { underscored: true },
    });
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('applies and reverts all migrations', async () => {
    const migrator = createMigrator(sequelize);
    await migrator.up();
    expect(await migrator.pending()).toHaveLength(0);

    await migrator.down({ to: 0 });
    const tables = await select<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    expect(tables.map(t => t.tablename)).toEqual(['sequelize_meta']);

    await migrator.up();
  });

  it('upgrades a database created by sync and merges duplicate direct chats', async () => {
    const migrator = createMigrator(sequelize);
    await migrator.up({ to: '0001-baseline' });

    await sequelize.query('ALTER TABLE users ADD CONSTRAINT users_email_key1 UNIQUE (email)');
    await sequelize.query('ALTER TABLE users ADD CONSTRAINT users_username_key1 UNIQUE (username)');

    const [alice, bob, carol] = [randomUUID(), randomUUID(), randomUUID()];
    for (const [id, name] of [[alice, 'alice'], [bob, 'bob'], [carol, 'carol']]) {
      await sequelize.query(
        `INSERT INTO users (id, username, email, password, display_name, created_at, updated_at)
         VALUES ('${id}', '${name}', '${name}@example.com', 'hash', '${name}', now(), now())`,
      );
    }

    const chats = { older: randomUUID(), newer: randomUUID(), other: randomUUID() };
    const insertChat = (id: string, creator: string, participants: string[], createdAt: string) => sequelize.query(
      `INSERT INTO chats (id, type, created_by, participants, admins, created_at, updated_at)
       VALUES ('${id}', 'direct', '${creator}', ARRAY['${participants.join("','")}']::uuid[], ARRAY['${creator}']::uuid[], '${createdAt}', '${createdAt}')`,
    );
    await insertChat(chats.older, alice, [alice, bob], '2024-01-01');
    await insertChat(chats.newer, bob, [bob, alice], '2024-02-01');
    await insertChat(chats.other, alice, [alice, carol], '2024-03-01');

    const insertMessage = (chatId: string, sender: string, content: string, createdAt: string) => sequelize.query(
      `INSERT INTO messages (id, chat_id, sender_id, content, created_at, updated_at)
       VALUES ('${randomUUID()}', '${chatId}', '${sender}', '${content}', '${createdAt}', '${createdAt}')`,
    );
    await insertMessage(chats.older, alice, 'first', '2024-01-02');
    await insertMessage(chats.newer, bob, 'second', '2024-02-02');
    await insertMessage(chats.older, alice, 'third', '2024-03-02');
    await insertMessage(chats.newer, bob, 'fourth', '2024-04-02');

    await migrator.up();

    const active = await select<{ id: string; direct_key: string; last: string }>(
      `SELECT c.id, c.direct_key, m.content AS last
       FROM chats c LEFT JOIN messages m ON m.id = c.last_message_id
       WHERE c.deleted_at IS NULL ORDER BY c.created_at`,
    );
    expect(active.map(c => c.id)).toEqual([chats.older, chats.other]);
    expect(active[0].direct_key).toBe(Chat.buildDirectKey(alice, bob));
    expect(active[1].direct_key).toBe(Chat.buildDirectKey(alice, carol));
    expect(active[0].last).toBe('fourth');

    const merged = await select<{ content: string }>(
      `SELECT content FROM messages WHERE chat_id = '${chats.older}' ORDER BY created_at`,
    );
    expect(merged.map(m => m.content)).toEqual(['first', 'second', 'third', 'fourth']);

    const constraints = await select<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'u' ORDER BY conname",
    );
    expect(constraints.map(c => c.conname)).toEqual(['users_email_key', 'users_username_key']);

    const roles = await select<{ role: string }>('SELECT DISTINCT role FROM users');
    expect(roles).toEqual([{ role: 'user' }]);

    await expect(sequelize.query(
      `INSERT INTO chats (id, type, created_by, participants, direct_key, created_at, updated_at)
       VALUES ('${randomUUID()}', 'direct', '${bob}', ARRAY['${bob}','${alice}']::uuid[], '${Chat.buildDirectKey(alice, bob)}', now(), now())`,
    )).rejects.toMatchObject({
      name: 'SequelizeUniqueConstraintError',
      parent: expect.objectContaining({ constraint: 'chats_direct_key_unique' }),
    });
  });
});
