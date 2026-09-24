import { Request, Response } from 'express';
import { messageService } from '../../container';
import { BadRequestError } from '../../core/errors';

interface PageQuery {
  q?: string;
  limit: number;
  offset: number;
}

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  const { limit, before } = res.locals.query as { limit: number; before?: string };
  res.status(200).json(await messageService.list(req.params.chatId, req.user!.id, limit, before));
};

export const getMessage = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json(await messageService.get(req.params.id, req.user!.id));
};

export const createMessage = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json(await messageService.create(req.user!.id, req.body));
};

export const updateMessage = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json(await messageService.updateContent(req.params.id, req.user!.id, req.body.content));
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  await messageService.delete(req.params.id, req.user!.id);
  res.status(204).send();
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  await messageService.markAsRead(req.params.id, req.user!.id);
  res.status(200).json({ message: 'Message marked as read' });
};

export const markChatAsRead = async (req: Request, res: Response): Promise<void> => {
  const messageIds = await messageService.markChatAsRead(req.params.id, req.user!.id);
  res.status(200).json({ messageIds });
};

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  const unreadCount = await messageService.countUnread(req.params.chatId, req.user!.id);
  res.status(200).json({ unreadCount });
};

export const getMediaMessages = async (req: Request, res: Response): Promise<void> => {
  const { limit, offset } = res.locals.query as PageQuery;
  res.status(200).json(await messageService.listMedia(req.params.chatId, req.user!.id, limit, offset));
};

export const searchMessages = async (req: Request, res: Response): Promise<void> => {
  const { q, limit, offset } = res.locals.query as PageQuery;
  if (!q) {
    throw new BadRequestError('Search query parameter "q" is required');
  }
  res.status(200).json(await messageService.search(req.params.chatId, req.user!.id, q, limit, offset));
};
