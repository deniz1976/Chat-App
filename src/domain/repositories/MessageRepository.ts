import { Message, MessageCreationAttributes } from '../entities/Message';

export interface MessageRepository {
  findById(id: string): Promise<Message | null>;
  existsInChat(id: string, chatId: string): Promise<boolean>;
  findPage(chatId: string, limit: number, beforeId?: string): Promise<Message[] | null>;
  findMedia(chatId: string, limit: number, offset: number): Promise<Message[]>;
  search(chatId: string, query: string, limit: number, offset: number): Promise<Message[]>;
  create(data: MessageCreationAttributes): Promise<Message>;
  updateContent(id: string, senderId: string, content: string): Promise<Message | null>;
  delete(id: string, senderId: string): Promise<boolean>;
  markAsRead(id: string, userId: string): Promise<boolean>;
  countUnread(chatId: string, userId: string): Promise<number>;
}
