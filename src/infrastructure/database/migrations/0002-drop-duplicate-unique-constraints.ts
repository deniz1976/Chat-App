import { Migration } from '../migrator';

export const up: Migration = async ({ sequelize }) => {
  await sequelize.query(`
    DO $$
    DECLARE
      duplicate record;
    BEGIN
      FOR duplicate IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND contype = 'u'
          AND conname ~ '^users_(email|username)_key[0-9]+$'
      LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', duplicate.conname);
      END LOOP;
    END $$;
  `);
};

export const down: Migration = async () => {};
