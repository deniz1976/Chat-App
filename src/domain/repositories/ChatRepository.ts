import { Chat, ChatCreationAttributes } from '../entities/Chat';

export interface ChatUpdate {
  name?: string | null;
  avatar?: string | null;
}

export interface ChatRepository {
  findById(id: string): Promise<Chat | null>;
  findByIdWithDetails(id: string): Promise<Chat | null>;
  findByDirectKey(directKey: string): Promise<Chat | null>;
  findForUser(userId: string): Promise<Chat[]>;
  findContactIds(userId: string): Promise<string[]>;
  create(data: ChatCreationAttributes): Promise<Chat>;
  update(id: string, data: ChatUpdate): Promise<Chat | null>;
  delete(id: string): Promise<boolean>;
  addParticipant(chatId: string, userId: string): Promise<string[] | null>;
  removeParticipant(chatId: string, userId: string): Promise<string[] | null>;
  addAdmin(chatId: string, userId: string): Promise<string[] | null>;
  removeAdmin(chatId: string, userId: string): Promise<string[] | null>;
  setLastMessage(chatId: string, messageId: string): Promise<void>;
}
