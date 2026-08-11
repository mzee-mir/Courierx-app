import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { ParsedQs } from 'qs';
import { ParamsDictionary } from 'express-serve-static-core';

type ValidationSchema = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export const validate = (schema: ValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.params) {
        req.params = (await schema.params.parseAsync(
          req.params
        )) as ParamsDictionary;
      }

      if (schema.query) {
        req.query = (await schema.query.parseAsync(
          req.query
        )) as ParsedQs;
      }

      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: error.issues,
        });
      }

      return res.status(500).json({
        error: 'INTERNAL_VALIDATION_FAILURE',
      });
    }
  };
};
