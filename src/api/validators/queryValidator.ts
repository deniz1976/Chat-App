import joi from 'joi';
import { validateQuery } from './validate';

export const MAX_PAGE_SIZE = 100;

const paginatedQuerySchema = joi.object({
  q: joi.string().trim().min(1).max(100),
  limit: joi.number().integer().min(1).max(MAX_PAGE_SIZE).default(50),
  offset: joi.number().integer().min(0).default(0),
});

export const validatePaginatedQuery = validateQuery(paginatedQuerySchema);
