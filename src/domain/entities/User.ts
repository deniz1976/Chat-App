import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';
import { Chat } from './Chat';
import { Message } from './Message';

export interface UserAttributes {
  id: string;
  username: string;
  email: string;
  password: string;
  displayName: string;
  profileImage: string | null;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'status' | 'lastSeen' | 'profileImage' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public displayName!: string;
  public profileImage!: string | null;
  public status!: 'online' | 'offline' | 'away';
  public lastSeen!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;
  public deletedAt!: Date | null;

  public async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  public static initialize(sequelize: Sequelize): void {
    User.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            len: [3, 30],
          },
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            isEmail: true,
          },
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        displayName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        profileImage: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('online', 'offline', 'away'),
          defaultValue: 'offline',
        },
        lastSeen: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
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
        tableName: 'users',
        sequelize,
        paranoid: true,
        hooks: {
          beforeCreate: async (user: User) => {
            if (user.password) {
              const salt = await bcrypt.genSalt(10);
              user.password = await bcrypt.hash(user.password, salt);
            }
          },
          beforeUpdate: async (user: User) => {
            if (user.changed('password')) {
              const salt = await bcrypt.genSalt(10);
              user.password = await bcrypt.hash(user.password, salt);
            }
          },
        },
      }
    );
  }
}

