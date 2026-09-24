import { Op, Sequelize, UniqueConstraintError, WhereOptions } from 'sequelize';
import { Chat, ChatAttributes, ChatCreationAttributes } from '../../domain/entities/Chat';
import { User } from '../../domain/entities/User';
import { Message } from '../../domain/entities/Message';
import { ChatRepository, ChatUpdate } from '../../domain/repositories/ChatRepository';
import { DuplicateEntityError } from '../../domain/repositories/errors';

const detailIncludes = [
  {
    model: User,
    as: 'creator',
    attributes: ['id', 'username', 'displayName', 'profileImage'],
  },
  {
    model: Message,
    as: 'lastMessage',
    attributes: ['id', 'content', 'type', 'mediaUrl', 'createdAt'],
  },
];

const hasMember = (column: 'participants' | 'admins', userId: string): WhereOptions<ChatAttributes> => ({
  [column]: { [Op.contains]: [userId] },
});

const lacksMember = (column: 'participants' | 'admins', userId: string): WhereOptions<ChatAttributes> => ({
  [Op.not]: hasMember(column, userId),
});

const appendTo = (column: string, userId: string) =>
  Sequelize.fn('array_append', Sequelize.col(column), Sequelize.cast(userId, 'uuid'));

const removeFrom = (column: string, userId: string) =>
  Sequelize.fn('array_remove', Sequelize.col(column), Sequelize.cast(userId, 'uuid'));

export class ChatRepositoryImpl implements ChatRepository {
  findById(id: string): Promise<Chat | null> {
    return Chat.findByPk(id);
  }

  findByIdWithDetails(id: string): Promise<Chat | null> {
    return Chat.findByPk(id, { include: detailIncludes });
  }

  findByDirectKey(directKey: string): Promise<Chat | null> {
    return Chat.findOne({ where: { directKey } });
  }

  findForUser(userId: string): Promise<Chat[]> {
    return Chat.findAll({
      where: hasMember('participants', userId),
      include: detailIncludes,
      order: [['updatedAt', 'DESC']],
    });
  }

  async findContactIds(userId: string): Promise<string[]> {
    const chats = await Chat.findAll({
      where: hasMember('participants', userId),
      attributes: ['participants'],
    });
    const contactIds = new Set<string>(chats.flatMap((chat) => chat.participants));
    contactIds.delete(userId);
    return Array.from(contactIds);
  }

  async create(data: ChatCreationAttributes): Promise<Chat> {
    try {
      return await Chat.create(data);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityError('Chat');
      }
      throw error;
    }
  }

  async update(id: string, data: ChatUpdate): Promise<Chat | null> {
    const chat = await Chat.findByPk(id);
    return chat ? chat.update(data) : null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await Chat.destroy({ where: { id } });
    return deleted > 0;
  }

  addParticipant(chatId: string, userId: string): Promise<string[] | null> {
    return this.updateMembers(
      chatId,
      { participants: appendTo('participants', userId) },
      lacksMember('participants', userId),
    );
  }

  removeParticipant(chatId: string, userId: string): Promise<string[] | null> {
    return this.updateMembers(
      chatId,
      { participants: removeFrom('participants', userId), admins: removeFrom('admins', userId) },
      hasMember('participants', userId),
    );
  }

  addAdmin(chatId: string, userId: string): Promise<string[] | null> {
    return this.updateMembers(
      chatId,
      { admins: appendTo('admins', userId) },
      { [Op.and]: [hasMember('participants', userId), lacksMember('admins', userId)] },
      'admins',
    );
  }

  removeAdmin(chatId: string, userId: string): Promise<string[] | null> {
    return this.updateMembers(chatId, { admins: removeFrom('admins', userId) }, hasMember('admins', userId), 'admins');
  }

  async setLastMessage(chatId: string, messageId: string | null): Promise<void> {
    await Chat.update({ lastMessageId: messageId }, { where: { id: chatId } });
  }

  private async updateMembers(
    chatId: string,
    values: Record<string, unknown>,
    condition: WhereOptions<ChatAttributes>,
    resultColumn: 'participants' | 'admins' = 'participants',
  ): Promise<string[] | null> {
    const [, rows] = await Chat.update(values, {
      where: { [Op.and]: [{ id: chatId }, condition] },
      returning: true,
    });
    return rows.length > 0 ? rows[0][resultColumn] : null;
  }
}
