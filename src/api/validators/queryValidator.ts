import joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const MAX_PAGE_SIZE = 100;

const paginatedQuerySchema = joi.object({
  q: joi.string().trim().min(1).max(100),
  limit: joi.number().integer().min(1).max(MAX_PAGE_SIZE).default(50),
  offset: joi.number().integer().min(0).default(0),
});

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

export const validatePaginatedQuery = validateQuery(paginatedQuerySchema);
