import joi from 'joi';
import { validateBody } from './validate';
import { UserRole } from '../../domain/entities/User';

const userUpdateSchema = joi
  .object({
    displayName: joi.string().min(2).max(50).optional().messages({
      'string.min': 'Display name must be at least 2 characters',
      'string.max': 'Display name cannot exceed 50 characters',
    }),
    profileImage: joi
      .string()
      .uri({ scheme: ['https'] })
      .allow(null)
      .optional(),
  })
  .min(1)
  .messages({
    'object.min': 'No update data provided',
    'object.unknown': '{{#label}} cannot be updated through this endpoint',
  });

const userStatusSchema = joi.object({
  status: joi.string().valid('online', 'offline', 'away').required().messages({
    'any.only': 'Invalid status value',
    'any.required': 'Status is required',
  }),
});

const userRoleSchema = joi.object({
  role: joi
    .string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      'any.only': 'Invalid role value',
      'any.required': 'Role is required',
    }),
});

export const validateUserUpdate = validateBody(userUpdateSchema);
export const validateUserStatus = validateBody(userStatusSchema);
export const validateUserRole = validateBody(userRoleSchema);
