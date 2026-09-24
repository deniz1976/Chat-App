import joi from 'joi';
import { validateBody } from './validate';

const loginSchema = joi.object({
  email: joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address',
    'any.required': 'Email address is required',
  }),
  password: joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required',
  }),
});

const registrationSchema = joi.object({
  username: joi.string().alphanum().min(3).max(30).required().messages({
    'string.alphanum': 'Username can only contain letters and numbers',
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username cannot exceed 30 characters',
    'any.required': 'Username is required',
  }),
  email: joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address',
    'any.required': 'Email address is required',
  }),
  password: joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required',
  }),
  displayName: joi.string().min(2).max(50).required().messages({
    'string.min': 'Display name must be at least 2 characters long',
    'string.max': 'Display name cannot exceed 50 characters',
    'any.required': 'Display name is required',
  }),
  profileImage: joi
    .string()
    .uri({ scheme: ['https'] })
    .optional(),
});

export const validateLogin = validateBody(loginSchema);

export const validateRegistration = validateBody(registrationSchema);
