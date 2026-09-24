import { Migration } from '../migrator';

export const up: Migration = async ({ sequelize }) => {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`
      ALTER TABLE chats ADD COLUMN IF NOT EXISTS direct_key varchar(255);

      CREATE TEMP TABLE direct_chat_keys ON COMMIT DROP AS
      SELECT
        id,
        key,
        first_value(id) OVER (PARTITION BY key ORDER BY created_at, id) AS keeper_id
      FROM (
        SELECT
          id,
          created_at,
          (SELECT string_agg(participant::text, ':' ORDER BY participant::text COLLATE "C") FROM unnest(participants) AS participant) AS key
        FROM chats
        WHERE type = 'direct' AND deleted_at IS NULL AND cardinality(participants) = 2
      ) AS keyed;

      UPDATE messages AS m
      SET chat_id = k.keeper_id
      FROM direct_chat_keys AS k
      WHERE m.chat_id = k.id AND k.id <> k.keeper_id;

      UPDATE chats AS c
      SET deleted_at = now(), last_message_id = NULL
      FROM direct_chat_keys AS k
      WHERE c.id = k.id AND k.id <> k.keeper_id;

      UPDATE chats AS c
      SET direct_key = k.key
      FROM direct_chat_keys AS k
      WHERE c.id = k.id AND k.id = k.keeper_id;

      UPDATE chats AS c
      SET last_message_id = (
        SELECT m.id FROM messages AS m
        WHERE m.chat_id = c.id AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ),
      updated_at = now()
      WHERE c.id IN (SELECT keeper_id FROM direct_chat_keys WHERE id <> keeper_id);

      CREATE UNIQUE INDEX IF NOT EXISTS chats_direct_key_unique ON chats (direct_key) WHERE deleted_at IS NULL;
    `, { transaction });
  });
};

export const down: Migration = async ({ sequelize }) => {
  await sequelize.query(`
    DROP INDEX IF EXISTS chats_direct_key_unique;
    ALTER TABLE chats DROP COLUMN IF EXISTS direct_key;
  `);
};
