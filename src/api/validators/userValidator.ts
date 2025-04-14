import joi from 'joi';
import { Request, Response, NextFunction } from 'express';

const userUpdateSchema = joi.object({
  username: joi.string().alphanum().min(3).max(30).optional().messages({
    'string.alphanum': 'Username can only contain alphanumeric characters',
    'string.min': 'Username must be at least 3 characters',
    'string.max': 'Username cannot exceed 30 characters'
  }),
  email: joi.string().email().optional().messages({
    'string.email': 'Please enter a valid email address'
  }),
  displayName: joi.string().min(2).max(50).optional().messages({
    'string.min': 'Display name must be at least 2 characters',
    'string.max': 'Display name cannot exceed 50 characters'
  }),
  password: joi.string().min(6).optional().messages({
    'string.min': 'Password must be at least 6 characters'
  }),
  currentPassword: joi.string().when('password', {
    is: joi.exist(),
    then: joi.required(),
    otherwise: joi.optional()
  }).messages({
    'any.required': 'Current password is required when changing password'
  }),
  profileImage: joi.string().uri().allow(null, '').optional()
});

const userStatusSchema = joi.object({
  status: joi.string().valid('online', 'offline', 'away').required().messages({
    'string.valid': 'Invalid status value',
    'any.required': 'Status is required'
  })
});

export const validateUserUpdate = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = userUpdateSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
};

export const validateUserStatus = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = userStatusSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
}; 