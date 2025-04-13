import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import { User } from './User';
import { Message } from './Message';

export enum ChatType {
  DIRECT = 'direct',
  GROUP = 'group',
}

export interface ChatAttributes {
  id: string;
  name: string | null;
  type: ChatType;
  avatar: string | null;
  lastMessageId: string | null;
  createdBy: string;
  participants: string[];
  admins: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ChatCreationAttributes extends Optional<ChatAttributes, 'id' | 'name' | 'avatar' | 'lastMessageId' | 'admins' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

export class Chat extends Model<ChatAttributes, ChatCreationAttributes> implements ChatAttributes {
  public id!: string;
  public name!: string | null;
  public type!: ChatType;
  public avatar!: string | null;
  public lastMessageId!: string | null;
  public createdBy!: string;
  public participants!: string[];
  public admins!: string[];
  public createdAt!: Date;
  public updatedAt!: Date;
  public deletedAt!: Date | null;

  public lastMessage?: Message;
  public creator?: User;
  public messages?: Message[];
  public users?: User[];

  public static initialize(sequelize: Sequelize): void {
    Chat.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        type: {
          type: DataTypes.ENUM(...Object.values(ChatType)),
          defaultValue: ChatType.DIRECT,
        },
        avatar: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        lastMessageId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'messages',
            key: 'id',
          },
        },
        createdBy: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        participants: {
          type: DataTypes.ARRAY(DataTypes.UUID),
          allowNull: false,
        },
        admins: {
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
        tableName: 'chats',
        sequelize,
        paranoid: true,
      }
    );
  }
}

// Removed Association Definitions 