import { Message, MessageCreationAttributes, MessageType } from '../entities/Message';

export interface MessageRepository {
  findById(id: string): Promise<Message | null>;
  findByChatId(chatId: string, limit?: number, offset?: number): Promise<Message[]>;
  findByType(type: MessageType, limit?: number, offset?: number): Promise<Message[]>;
  findBySenderId(senderId: string, limit?: number, offset?: number): Promise<Message[]>;
  findByMediaType(chatId: string, type: MessageType, limit?: number, offset?: number): Promise<Message[]>;
  create(messageData: MessageCreationAttributes): Promise<Message>;
  update(id: string, messageData: Partial<MessageCreationAttributes>): Promise<Message | null>;
  delete(id: string): Promise<boolean>;
  markAsRead(messageId: string, userId: string): Promise<Message | null>;
  getUnreadCount(chatId: string, userId: string): Promise<number>;
  search(chatId: string, query: string, limit?: number, offset?: number): Promise<Message[]>;
} 