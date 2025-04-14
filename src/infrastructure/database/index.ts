import { Sequelize } from 'sequelize';
import { config, Config } from '../../config';
import { logger } from '../../utils/logger';

import { User } from '../../domain/entities/User';
import { Chat } from '../../domain/entities/Chat';
import { Message } from '../../domain/entities/Message';

const { dialect, host, port, user, password, database, ssl } = config.db as Config['db'];
export const sequelize = new Sequelize({
  dialect: dialect,
  host,
  port,
  username: user,
  password,
  database,
  logging: (msg) => logger.debug(msg),
  dialectOptions: {
    ssl: ssl ? { require: true, rejectUnauthorized: false } : false,
  },
  define: {
    underscored: true,
    timestamps: true,
    paranoid: true,
  },
});

const initializeModels = (sequelizeInstance: Sequelize) => {
  User.initialize(sequelizeInstance);
  Chat.initialize(sequelizeInstance);
  Message.initialize(sequelizeInstance);
  logger.info('Models initialized.');
};

const defineAssociations = () => {
  User.hasMany(Chat, { foreignKey: 'createdBy', as: 'createdChats' });
  User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });

  Chat.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
  Chat.belongsTo(Message, { as: 'lastMessage', foreignKey: 'lastMessageId', constraints: false });
  Chat.hasMany(Message, { foreignKey: 'chatId', as: 'messages' });

  Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
  Message.belongsTo(Chat, { as: 'chat', foreignKey: 'chatId' });
  Message.belongsTo(Message, { as: 'replyTo', foreignKey: 'replyToId', constraints: false });

  logger.info('Model associations defined.');
};

export const setupDatabase = async (): Promise<void> => {
  try {
    initializeModels(sequelize);

    defineAssociations();

    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');

    await sequelize.sync({ alter: true });
    logger.info('Database models synchronized.');

  } catch (error) {
    logger.error('Unable to setup database:', { error });
    throw error;
  }
}; 