import joi from 'joi';
import { MessageType } from '../../domain/entities/Message';
import { MAX_PAGE_SIZE } from './queryValidator';
import { validateBody, validateQuery } from './validate';

const messageCreationSchema = joi.object({
  chatId: joi.string().uuid().required().messages({
    'string.uuid': 'Please enter a valid chat ID',
    'any.required': 'Chat ID is required',
  }),
  content: joi.string().required().messages({
    'any.required': 'Message content is required',
  }),
  type: joi.string().valid(...Object.values(MessageType)).default(MessageType.TEXT).messages({
    'any.only': 'Please enter a valid message type',
  }),
  mediaUrl: joi.string().uri({ scheme: ['https'] }).allow(null, '').optional(),
  replyToId: joi.string().uuid().allow(null, '').optional(),
});

const messageUpdateSchema = joi.object({
  content: joi.string().required().messages({
    'any.required': 'Message content is required for update',
  }),
});

export const validateMessageCreation = validateBody(messageCreationSchema);

export const validateMessageUpdate = validateBody(messageUpdateSchema);

const messageListQuerySchema = joi.object({
  limit: joi.number().integer().min(1).max(MAX_PAGE_SIZE).default(50),
  before: joi.string().uuid().optional(),
});

export const validateMessageListQuery = validateQuery(messageListQuerySchema);
