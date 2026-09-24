import { Migration } from '../migrator';

export const up: Migration = async ({ sequelize }) => {
  await sequelize.query('CREATE INDEX IF NOT EXISTS messages_chat_id_created_at ON messages (chat_id, created_at);');
};

export const down: Migration = async ({ sequelize }) => {
  await sequelize.query('DROP INDEX IF EXISTS messages_chat_id_created_at;');
};
