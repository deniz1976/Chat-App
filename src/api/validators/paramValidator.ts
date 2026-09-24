import joi from 'joi';
import { Request, Response, NextFunction, Router } from 'express';

const uuidSchema = joi.string().uuid().required();

const validateUuidParam = (req: Request, res: Response, next: NextFunction, value: string, name: string): void => {
  if (uuidSchema.validate(value).error) {
    res.status(400).json({ message: `Invalid ${name}` });
    return;
  }
  next();
};

export const validateUuidParams = (router: Router, ...names: string[]): void => {
  names.forEach((name) => router.param(name, validateUuidParam));
};
