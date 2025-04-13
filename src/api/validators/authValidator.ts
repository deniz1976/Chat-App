import joi from 'joi';
import { Request, Response, NextFunction } from 'express';

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
  profileImage: joi.string().uri().optional(),
});

export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
};

export const validateRegistration = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = registrationSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
}; 