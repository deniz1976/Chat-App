import { Migration } from '../migrator';

export const up: Migration = async ({ sequelize }) => {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_role') THEN
          CREATE TYPE enum_users_role AS ENUM ('user', 'admin');
        END IF;
      END $$;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS role enum_users_role NOT NULL DEFAULT 'user';
    `,
      { transaction },
    );
  });
};

export const down: Migration = async ({ sequelize }) => {
  await sequelize.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS role;
    DROP TYPE IF EXISTS enum_users_role;
  `);
};
