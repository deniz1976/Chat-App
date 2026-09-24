import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';

export type UserStatus = 'online' | 'offline' | 'away';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface UserAttributes {
  id: string;
  username: string;
  email: string;
  password: string;
  displayName: string;
  profileImage: string | null;
  status: UserStatus;
  role: UserRole;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type UserCreationAttributes = Optional<UserAttributes, 'id' | 'status' | 'role' | 'lastSeen' | 'profileImage' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare username: string;
  declare email: string;
  declare password: string;
  declare displayName: string;
  declare profileImage: string | null;
  declare status: UserStatus;
  declare role: UserRole;
  declare lastSeen: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;

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
        role: {
          type: DataTypes.ENUM(...Object.values(UserRole)),
          allowNull: false,
          defaultValue: UserRole.USER,
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

