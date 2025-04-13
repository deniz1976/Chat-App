import joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { MessageType } from '../../domain/entities/Message';

// Validation schemas
const messageCreationSchema = joi.object({
  chatId: joi.string().uuid().required().messages({
    'string.uuid': 'Please enter a valid chat ID',
    'any.required': 'Chat ID is required',
  }),
  content: joi.string().required().messages({
    'any.required': 'Message content is required',
  }),
  type: joi.string().valid(...Object.values(MessageType)).default(MessageType.TEXT).messages({
    'string.valid': 'Please enter a valid message type',
  }),
  mediaUrl: joi.string().uri().allow(null, '').optional(),
  replyToId: joi.string().uuid().allow(null, '').optional(),
});

const messageUpdateSchema = joi.object({
  content: joi.string().optional(),
  mediaUrl: joi.string().uri().allow(null, '').optional(),
});

// Middleware functions
export const validateMessageCreation = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = messageCreationSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
};

export const validateMessageUpdate = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = messageUpdateSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
}; 