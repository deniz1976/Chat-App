import { Request, Response } from 'express';
import { chatService } from '../../container';

/**
 * @swagger
 * components:
 *   schemas:
 *     Chat:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: [direct, group]
 *         avatar:
 *           type: string
 *           format: uri
 *           nullable: true
 *         createdBy:
 *           type: string
 *           format: uuid
 *         participants:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *         admins:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *         lastMessageId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /chats:
 *   get:
 *     summary: Get all chats for current user
 *     tags: [Chats]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of chats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Chat'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getChats = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json(await chatService.listForUser(req.user!.id));
};

/**
 * @swagger
 * /chats/{id}:
 *   get:
 *     summary: Get chat by ID
 *     tags: [Chats]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Chat details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not a participant
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Server error
 */
export const getChat = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json(await chatService.getForUser(req.params.id, req.user!.id));
};

/**
 * @swagger
 * /chats:
 *   post:
 *     summary: Create a new chat
 *     tags: [Chats]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - participants
 *             properties:
 *               name:
 *                 type: string
 *                 description: Chat name (required for group chats)
 *               type:
 *                 type: string
 *                 enum: [direct, group]
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: User IDs to include in chat (creator is automatically added)
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 description: URL to chat avatar image
 *     responses:
 *       201:
 *         description: Chat created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const createChat = async (req: Request, res: Response): Promise<void> => {
  const { chat, created } = await chatService.create(req.user!.id, req.body);
  res.status(created ? 201 : 200).json(chat);
};

export const updateChat = async (req: Request, res: Response): Promise<void> => {
  const { name, avatar } = req.body;
  res.status(200).json(await chatService.update(req.params.id, req.user!.id, { name, avatar }));
};

export const deleteChat = async (req: Request, res: Response): Promise<void> => {
  await chatService.delete(req.params.id, req.user!.id);
  res.status(204).send();
};

export const addParticipant = async (req: Request, res: Response): Promise<void> => {
  const participants = await chatService.addParticipant(req.params.id, req.user!.id, req.body.userId);
  res.status(200).json({ participants });
};

export const removeParticipant = async (req: Request, res: Response): Promise<void> => {
  const participants = await chatService.removeParticipant(req.params.id, req.user!.id, req.params.userId);
  res.status(200).json({ participants });
};

export const leaveChat = async (req: Request, res: Response): Promise<void> => {
  await chatService.leave(req.params.id, req.user!.id);
  res.status(204).send();
};

export const addAdmin = async (req: Request, res: Response): Promise<void> => {
  const admins = await chatService.addAdmin(req.params.id, req.user!.id, req.body.userId);
  res.status(200).json({ admins });
};

export const removeAdmin = async (req: Request, res: Response): Promise<void> => {
  const admins = await chatService.removeAdmin(req.params.id, req.user!.id, req.params.userId);
  res.status(200).json({ admins });
};
