import { Op, Sequelize, WhereOptions } from 'sequelize';
import { Message, MessageAttributes, MessageCreationAttributes, MessageType } from '../../domain/entities/Message';
import { User } from '../../domain/entities/User';
import { MessageRepository } from '../../domain/repositories/MessageRepository';
import { escapeLikePattern } from '../../utils/escapeLikePattern';

const senderInclude = [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'profileImage'] }];

const MEDIA_TYPES = [MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.FILE];

export class MessageRepositoryImpl implements MessageRepository {
  findById(id: string): Promise<Message | null> {
    return Message.findByPk(id, { include: senderInclude });
  }

  async existsInChat(id: string, chatId: string): Promise<boolean> {
    const count = await Message.count({ where: { id, chatId } });
    return count > 0;
  }

  async findPage(chatId: string, limit: number, beforeId?: string): Promise<Message[] | null> {
    const conditions: WhereOptions<MessageAttributes>[] = [{ chatId }];

    if (beforeId) {
      const cursor = await Message.findOne({ where: { id: beforeId, chatId }, attributes: ['id', 'createdAt'] });
      if (!cursor) {
        return null;
      }
      conditions.push({
        [Op.or]: [
          { createdAt: { [Op.lt]: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { [Op.lt]: cursor.id } },
        ],
      });
    }

    const messages = await Message.findAll({
      where: { [Op.and]: conditions },
      limit,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      include: senderInclude,
    });

    return messages.reverse();
  }

  findMedia(chatId: string, limit: number, offset: number): Promise<Message[]> {
    return Message.findAll({
      where: { chatId, type: { [Op.in]: MEDIA_TYPES } },
      limit,
      offset,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      include: senderInclude,
    });
  }

  search(chatId: string, query: string, limit: number, offset: number): Promise<Message[]> {
    return Message.findAll({
      where: { chatId, content: { [Op.iLike]: `%${escapeLikePattern(query)}%` } },
      limit,
      offset,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      include: senderInclude,
    });
  }

  async create(data: MessageCreationAttributes): Promise<Message> {
    const message = await Message.create(data);
    return (await this.findById(message.id))!;
  }

  async updateContent(id: string, senderId: string, content: string): Promise<Message | null> {
    const [updated] = await Message.update({ content }, { where: { id, senderId } });
    return updated > 0 ? this.findById(id) : null;
  }

  async delete(id: string, senderId: string): Promise<boolean> {
    const deleted = await Message.destroy({ where: { id, senderId } });
    return deleted > 0;
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const [updated] = await Message.update(
      {
        readBy: Sequelize.fn(
          'array_append',
          Sequelize.col('read_by'),
          Sequelize.cast(userId, 'uuid'),
        ) as unknown as string[],
      },
      { where: { id, [Op.not]: { readBy: { [Op.contains]: [userId] } } } },
    );
    return updated > 0;
  }

  countUnread(chatId: string, userId: string): Promise<number> {
    return Message.count({
      where: {
        chatId,
        senderId: { [Op.ne]: userId },
        [Op.not]: { readBy: { [Op.contains]: [userId] } },
      },
    });
  }
}
