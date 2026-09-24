import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import { User } from './User';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
}

export interface MessageAttributes {
  id: string;
  senderId: string;
  chatId: string;
  content: string;
  type: MessageType;
  mediaUrl?: string | null;
  replyToId?: string | null;
  readBy: string[];
  editedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type MessageCreationAttributes = Optional<
  MessageAttributes,
  'id' | 'mediaUrl' | 'replyToId' | 'readBy' | 'editedAt' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  declare id: string;
  declare senderId: string;
  declare chatId: string;
  declare content: string;
  declare type: MessageType;
  declare mediaUrl: string | null;
  declare replyToId: string | null;
  declare readBy: string[];
  declare editedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

  declare sender?: User;
  declare replyTo?: Message;

  public static initialize(sequelize: Sequelize): void {
    Message.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        senderId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        chatId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'chats',
            key: 'id',
          },
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        type: {
          type: DataTypes.ENUM(...Object.values(MessageType)),
          defaultValue: MessageType.TEXT,
        },
        mediaUrl: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        replyToId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'messages',
            key: 'id',
          },
        },
        readBy: {
          type: DataTypes.ARRAY(DataTypes.UUID),
          defaultValue: [],
        },
        editedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        tableName: 'messages',
        sequelize,
        paranoid: true,
      },
    );
  }
}
