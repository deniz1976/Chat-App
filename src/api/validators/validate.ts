import joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const validateBody = (schema: joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body ?? {});
    if (error) {
      res.status(400).json({ message: error.details[0].message });
      return;
    }
    req.body = value;
    next();
  };
};

export const validateQuery = (schema: joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query);
    if (error) {
      res.status(400).json({ message: error.details[0].message });
      return;
    }
    res.locals.query = value;
    next();
  };
};
