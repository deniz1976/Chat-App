import { Migration } from '../migrator';

export const up: Migration = async ({ queryInterface, sequelize }) => {
  const tables = await queryInterface.showAllTables();
  if (tables.includes('users')) {
    return;
  }

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`
      CREATE TYPE enum_users_status AS ENUM ('online', 'offline', 'away');
      CREATE TYPE enum_chats_type AS ENUM ('direct', 'group');
      CREATE TYPE enum_messages_type AS ENUM ('text', 'image', 'video', 'audio', 'file');

      CREATE TABLE users (
        id uuid PRIMARY KEY,
        username varchar(255) NOT NULL CONSTRAINT users_username_key UNIQUE,
        email varchar(255) NOT NULL CONSTRAINT users_email_key UNIQUE,
        password varchar(255) NOT NULL,
        display_name varchar(255) NOT NULL,
        profile_image varchar(255),
        status enum_users_status DEFAULT 'offline',
        last_seen timestamptz,
        created_at timestamptz,
        updated_at timestamptz,
        deleted_at timestamptz
      );

      CREATE TABLE chats (
        id uuid PRIMARY KEY,
        name varchar(255),
        type enum_chats_type DEFAULT 'direct',
        avatar varchar(255),
        last_message_id uuid,
        created_by uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        participants uuid[] NOT NULL,
        admins uuid[] DEFAULT ARRAY[]::uuid[],
        created_at timestamptz,
        updated_at timestamptz,
        deleted_at timestamptz
      );

      CREATE TABLE messages (
        id uuid PRIMARY KEY,
        sender_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        chat_id uuid NOT NULL REFERENCES chats(id) ON UPDATE CASCADE ON DELETE CASCADE,
        content text NOT NULL,
        type enum_messages_type DEFAULT 'text',
        media_url varchar(255),
        reply_to_id uuid REFERENCES messages(id),
        read_by uuid[] DEFAULT ARRAY[]::uuid[],
        created_at timestamptz,
        updated_at timestamptz,
        deleted_at timestamptz
      );

      ALTER TABLE chats
        ADD CONSTRAINT chats_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES messages(id);
    `, { transaction });
  });
};

export const down: Migration = async ({ sequelize }) => {
  await sequelize.query(`
    DROP TABLE IF EXISTS messages, chats, users CASCADE;
    DROP TYPE IF EXISTS enum_messages_type, enum_chats_type, enum_users_status;
  `);
};
