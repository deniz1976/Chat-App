import { Request, Response } from 'express';
import { Chat, ChatType, ChatCreationAttributes } from '../../domain/entities/Chat';
import { User } from '../../domain/entities/User';
import { Message } from '../../domain/entities/Message';
import { logger } from '../../utils/logger';
import { Op } from 'sequelize';

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
 *       - bearerAuth: []
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
  try {
    const userId = req.user!.id;
    
    // Find all chats where user is a participant
    const chats = await Chat.findAll({
      where: {
        participants: {
          [Op.contains]: [userId]
        }
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'displayName', 'profileImage']
        },
        {
          model: Message,
          as: 'lastMessage',
          attributes: ['id', 'content', 'type', 'mediaUrl', 'createdAt']
        }
      ],
      order: [['updatedAt', 'DESC']]
    });
    
    res.status(200).json(chats);
  } catch (error: any) {
    logger.error('Error getting chats', { error, userId: req.user!.id });
    res.status(500).json({ message: 'Failed to get chats' });
  }
};

/**
 * @swagger
 * /chats/{id}:
 *   get:
 *     summary: Get chat by ID
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
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
  try {
    
    const { id } = req.params;
    const userId = req.user!.id;
    
  
    const chat = await Chat.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'displayName', 'profileImage']
        },
        {
          model: Message,
          as: 'lastMessage',
          attributes: ['id', 'content', 'type', 'mediaUrl', 'createdAt']
        }
      ]
    });
    
    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }
    
    if (!chat.participants.includes(userId)) {
      res.status(403).json({ message: 'You are not a participant in this chat' });
      return;
    }
    
    res.status(200).json(chat);
  } catch (error: any) {
    logger.error('Error getting chat', { error, chatId: req.params.id, userId: req.user!.id });
    res.status(500).json({ message: 'Failed to get chat' });
  }
};

/**
 * @swagger
 * /chats:
 *   post:
 *     summary: Create a new chat
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
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
  try {
    const { name, type, participants, avatar } = req.body;
    const userId = req.user!.id;
    
    // Validate input
    if (type === ChatType.GROUP && !name) {
      res.status(400).json({ message: 'Group chats require a name' });
      return;
    }
    
    if (type === ChatType.DIRECT && participants.length !== 1) {
      res.status(400).json({ message: 'Direct chats must have exactly one participant (other than yourself)' });
      return;
    }
    
    if (type === ChatType.DIRECT) {
      const otherUserId = participants[0];
      
      const existingChat = await Chat.findOne({
        where: {
          type: ChatType.DIRECT,
          participants: {
            [Op.contains]: [userId, otherUserId],
            [Op.eq]: [userId, otherUserId]  
          }
        }
      });
      
      if (existingChat) {
        res.status(200).json(existingChat);
        return;
      }
    }
    
    const allParticipants = [...new Set([userId, ...participants])]; 
    
    const chatData: ChatCreationAttributes = {
      name: type === ChatType.DIRECT ? null : name,
      type,
      avatar,
      createdBy: userId,
      participants: allParticipants,
      admins: [userId],
    };
    
    const chat = await Chat.create(chatData);
    
    res.status(201).json(chat);
  } catch (error: any) {
    logger.error('Error creating chat', { error, userId: req.user!.id });
    res.status(500).json({ message: 'Failed to create chat' });
  }
};

export const updateChat = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, avatar } = req.body;
  const userId = req.user!.id;

  try {
    const chat = await Chat.findByPk(id);

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    if (chat.type === ChatType.GROUP && !chat.admins.includes(userId) && chat.createdBy !== userId) {
      res.status(403).json({ message: 'Only admins or the creator can update group chat details' });
      return;
    }
    if (chat.type === ChatType.DIRECT) {
       res.status(403).json({ message: 'Cannot update details of a direct chat' });
       return;
    }

    const updateData: Partial<ChatCreationAttributes> = {};
    if (name !== undefined) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: 'No update data provided' });
      return;
    }

    const updatedChat = await chat.update(updateData);

    res.status(200).json(updatedChat);
    logger.info(`Updated chat ${id} by user ${userId}`);
  } catch (error: any) {
    logger.error(`Error updating chat ${id}`, { error, userId });
    res.status(500).json({ message: 'Failed to update chat' });
  }
};

export const deleteChat = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const chat = await Chat.findByPk(id);

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    if (chat.createdBy !== userId) {
       res.status(403).json({ message: 'Only the creator can delete this chat' });
       return;
    }
    await chat.destroy();

    res.status(204).send(); 
    logger.info(`Deleted chat ${id} by user ${userId}`);
  } catch (error: any) {
    logger.error(`Error deleting chat ${id}`, { error, userId });
    res.status(500).json({ message: 'Failed to delete chat' });
  }
};

export const addParticipant = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; 
  const { userId: participantId } = req.body; 
  const requesterId = req.user!.id;

  if (!participantId) {
      res.status(400).json({ message: 'User ID to add is required' });
      return;
  }

  try {
    const chat = await Chat.findByPk(id);

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    if (chat.type !== ChatType.GROUP) {
      res.status(400).json({ message: 'Cannot add participants to a direct chat' });
      return;
    }

    if (!chat.admins.includes(requesterId) && chat.createdBy !== requesterId) {
      res.status(403).json({ message: 'Only admins or the creator can add participants' });
      return;
    }

    if (chat.participants.includes(participantId)) {
      res.status(409).json({ message: 'User is already a participant' });
      return;
    }

    const updatedParticipants = [...chat.participants, participantId];
    await chat.update({ participants: updatedParticipants });

    res.status(200).json({ participants: updatedParticipants });
    logger.info(`Added participant ${participantId} to chat ${id} by user ${requesterId}`);
  } catch (error: any) {
    logger.error(`Error adding participant to chat ${id}`, { error, requesterId, participantId });
    res.status(500).json({ message: 'Failed to add participant' });
  }
};

export const removeParticipant = async (req: Request, res: Response): Promise<void> => {
  const { id, participantId } = req.params; 
  const requesterId = req.user!.id;

  if (participantId === requesterId) {
      res.status(400).json({ message: 'You cannot remove yourself using this endpoint. Use leave chat instead.' });
      return;
  }

  try {
    const chat = await Chat.findByPk(id);

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    if (chat.type !== ChatType.GROUP) {
      res.status(400).json({ message: 'Cannot remove participants from a direct chat' });
      return;
    }

    if (!chat.admins.includes(requesterId) && chat.createdBy !== requesterId) {
      res.status(403).json({ message: 'Only admins or the creator can remove participants' });
      return;
    }

    if (!chat.participants.includes(participantId)) {
      res.status(404).json({ message: 'User is not a participant in this chat' });
      return;
    }

    const updatedParticipants = chat.participants.filter(p => p !== participantId);
    const updatedAdmins = chat.admins.filter(a => a !== participantId);
    await chat.update({ participants: updatedParticipants, admins: updatedAdmins });

    res.status(200).json({ participants: updatedParticipants });
    logger.info(`Removed participant ${participantId} from chat ${id} by user ${requesterId}`);
  } catch (error: any) {
    logger.error(`Error removing participant ${participantId} from chat ${id}`, { error, requesterId });
    res.status(500).json({ message: 'Failed to remove participant' });
  }
};

export const addAdmin = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; 
  const { userId: adminId } = req.body;
  const requesterId = req.user!.id;

  if (!adminId) {
      res.status(400).json({ message: 'User ID to make admin is required' });
      return;
  }

  try {
    const chat = await Chat.findByPk(id);

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    if (chat.type !== ChatType.GROUP) {
      res.status(400).json({ message: 'Cannot manage admins in a direct chat' });
      return;
    }

    if (!chat.admins.includes(requesterId) && chat.createdBy !== requesterId) {
      res.status(403).json({ message: 'Only admins or the creator can add new admins' });
      return;
    }

    if (!chat.participants.includes(adminId)) {
      res.status(400).json({ message: 'Cannot make a non-participant an admin' });
      return;
    }

    if (chat.admins.includes(adminId)) {
      res.status(409).json({ message: 'User is already an admin' });
      return;
    }

    const updatedAdmins = [...chat.admins, adminId];
    await chat.update({ admins: updatedAdmins });

    res.status(200).json({ admins: updatedAdmins });
    logger.info(`Added admin ${adminId} to chat ${id} by user ${requesterId}`);
  } catch (error: any) {
    logger.error(`Error adding admin ${adminId} to chat ${id}`, { error, requesterId });
    res.status(500).json({ message: 'Failed to add admin' });
  }
};

export const removeAdmin = async (req: Request, res: Response): Promise<void> => {
  const { id, adminId } = req.params;
  const requesterId = req.user!.id;

  try {
    const chat = await Chat.findByPk(id);

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    if (adminId === chat.createdBy) {
        res.status(400).json({ message: 'Cannot remove the chat creator from admins' });
        return;
    }

    if (chat.type !== ChatType.GROUP) {
      res.status(400).json({ message: 'Cannot manage admins in a direct chat' });
      return;
    }

    if (!chat.admins.includes(requesterId) && chat.createdBy !== requesterId) {
      res.status(403).json({ message: 'Only admins or the creator can remove admins' });
      return;
    }

    if (!chat.admins.includes(adminId)) {
      res.status(404).json({ message: 'User is not an admin in this chat' });
      return;
    }

    const updatedAdmins = chat.admins.filter(a => a !== adminId);
    await chat.update({ admins: updatedAdmins });

    res.status(200).json({ admins: updatedAdmins });
    logger.info(`Removed admin ${adminId} from chat ${id} by user ${requesterId}`);
  } catch (error: any) {
    logger.error(`Error removing admin ${adminId} from chat ${id}`, { error, requesterId });
    res.status(500).json({ message: 'Failed to remove admin' });
  }
};

