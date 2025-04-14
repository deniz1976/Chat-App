import joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ChatType } from '../../domain/entities/Chat';

const chatCreationSchema = joi.object({
  name: joi.string().min(3).max(50).when('type', {
    is: ChatType.GROUP,
    then: joi.required(),
    otherwise: joi.optional().allow(null, '')
  }).messages({
    'string.min': 'Chat name must be at least 3 characters',
    'string.max': 'Chat name cannot exceed 50 characters',
    'any.required': 'Group chats require a name'
  }),
  type: joi.string().valid(...Object.values(ChatType)).required().messages({
    'string.valid': 'Please enter a valid chat type',
    'any.required': 'Chat type is required'
  }),
  participants: joi.array().items(joi.string().uuid()).min(1).required().messages({
    'array.min': 'At least one participant is required',
    'any.required': 'Participants are required'
  }),
  avatar: joi.string().uri().allow(null, '').optional()
});

const chatUpdateSchema = joi.object({
  name: joi.string().min(3).max(50).optional().messages({
    'string.min': 'Chat name must be at least 3 characters',
    'string.max': 'Chat name cannot exceed 50 characters'
  }),
  avatar: joi.string().uri().allow(null, '').optional()
});

const participantSchema = joi.object({
  userId: joi.string().uuid().required().messages({
    'string.uuid': 'Please enter a valid user ID',
    'any.required': 'User ID is required'
  })
});

export const validateChatCreation = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = chatCreationSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
};

export const validateChatUpdate = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = chatUpdateSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
};

export const validateParticipant = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = participantSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
}; 