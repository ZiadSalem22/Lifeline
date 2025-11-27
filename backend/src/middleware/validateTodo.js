const Joi = require('joi');
const { AppError } = require('../utils/errors');

const todoSchemaCreate = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().max(2000).allow('', null).optional(),
  dueDate: Joi.alternatives(Joi.string().isoDate(), Joi.valid(null)).optional(),
  recurrence: Joi.alternatives(Joi.object(), Joi.string(), Joi.valid(null)).optional(),
  tags: Joi.array().items(Joi.object({ id: Joi.string().required(), name: Joi.string().required(), color: Joi.string().required() })).default([]),
  isFlagged: Joi.boolean().optional(),
  duration: Joi.number().integer().min(0).max(1440).optional(),
  priority: Joi.string().valid('high','medium','low').optional(),
  dueTime: Joi.string().allow('', null).optional(),
  subtasks: Joi.array().items(Joi.object()).optional(),
});

const todoSchemaUpdate = Joi.object({
  title: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  dueDate: Joi.alternatives(Joi.string().isoDate(), Joi.valid(null)).optional(),
  recurrence: Joi.alternatives(Joi.object(), Joi.string(), Joi.valid(null)).optional(),
  tags: Joi.array().items(Joi.object({ id: Joi.string().required(), name: Joi.string().required(), color: Joi.string().required() })).optional(),
  isFlagged: Joi.boolean().optional(),
  duration: Joi.number().integer().min(0).max(1440).optional(),
  priority: Joi.string().valid('high','medium','low').optional(),
  dueTime: Joi.string().allow('', null).optional(),
  subtasks: Joi.array().items(Joi.object()).optional(),
});

function validate(schema) {
  return function (req, res, next) {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return next(new AppError(error.details.map(d=>d.message).join('; '), 400));
    }
    req.body = value;
    next();
  };
}

module.exports = {
  validateTodoCreate: validate(todoSchemaCreate),
  validateTodoUpdate: validate(todoSchemaUpdate),
};
