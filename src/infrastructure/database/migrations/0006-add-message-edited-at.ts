import { Migration } from '../migrator';

export const up: Migration = async ({ sequelize }) => {
  await sequelize.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;');
};

export const down: Migration = async ({ sequelize }) => {
  await sequelize.query('ALTER TABLE messages DROP COLUMN IF EXISTS edited_at;');
};
