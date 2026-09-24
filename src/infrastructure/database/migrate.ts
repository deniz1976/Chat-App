import { sequelize } from '.';
import { createMigrator } from './migrator';
import { logger } from '../../utils/logger';

const run = async (): Promise<void> => {
  const migrator = createMigrator(sequelize);
  const command = process.argv[2] ?? 'up';

  if (command === 'up') {
    const applied = await migrator.up();
    logger.info(`Applied ${applied.length} migration(s)`);
  } else if (command === 'down') {
    const reverted = await migrator.down();
    logger.info(`Reverted ${reverted.length} migration(s)`);
  } else if (command === 'status') {
    const [executed, pending] = await Promise.all([migrator.executed(), migrator.pending()]);
    logger.info(`Executed: ${executed.map((m) => m.name).join(', ') || 'none'}`);
    logger.info(`Pending: ${pending.map((m) => m.name).join(', ') || 'none'}`);
  } else {
    throw new Error(`Unknown migration command: ${command}`);
  }
};

run()
  .then(() => sequelize.close())
  .catch(async (error) => {
    logger.error('Migration failed', { error });
    await sequelize.close();
    process.exit(1);
  });
