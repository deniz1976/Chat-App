import './env';
import { recreateDatabase } from './database';

export default async (): Promise<void> => {
  await recreateDatabase(process.env.DB_NAME!);
  const { sequelize } = await import('../src/infrastructure/database');
  const { createMigrator } = await import('../src/infrastructure/database/migrator');
  await createMigrator(sequelize).up();
  await sequelize.close();
};
