import path from 'path';
import { QueryInterface, Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { logger } from '../../utils/logger';

export interface MigrationContext {
  queryInterface: QueryInterface;
  sequelize: Sequelize;
}

export type Migration = (context: MigrationContext) => Promise<void>;

export const createMigrator = (sequelize: Sequelize) =>
  new Umzug<MigrationContext>({
    migrations: {
      glob: ['migrations/*.{ts,js}', { cwd: __dirname, ignore: '**/*.d.ts' }],
      resolve: ({ name, path: migrationPath, context }) => {
        const load = (): Promise<{ up: Migration; down: Migration }> => import(migrationPath!);
        return {
          name: path.basename(name, path.extname(name)),
          up: async () => (await load()).up(context),
          down: async () => (await load()).down(context),
        };
      },
    },
    context: { queryInterface: sequelize.getQueryInterface(), sequelize },
    storage: new SequelizeStorage({ sequelize }),
    logger: {
      info: (message) => logger.info('Migration', message),
      warn: (message) => logger.warn('Migration', message),
      error: (message) => logger.error('Migration', message),
      debug: (message) => logger.debug('Migration', message),
    },
  });
