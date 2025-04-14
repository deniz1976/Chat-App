import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import { User } from './User';
import { Chat } from './Chat';

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
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface MessageCreationAttributes extends Optional<MessageAttributes, 'id' | 'mediaUrl' | 'replyToId' | 'readBy' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

export class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  public id!: string;
  public senderId!: string;
  public chatId!: string;
  public content!: string;
  public type!: MessageType;
  public mediaUrl!: string | null;
  public replyToId!: string | null;
  public readBy!: string[];
  public createdAt!: Date;
  public updatedAt!: Date;
  public deletedAt!: Date | null;

  public sender?: User;
  public replyTo?: Message;

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
      }
    );
  }
}

