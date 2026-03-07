const express = require('express');
const { CreateTodoForInternalMcp } = require('../../application/CreateTodoForInternalMcp');
const CreateTodo = require('../../application/CreateTodo');
const DeleteTodo = require('../../application/DeleteTodo');
const ListTodos = require('../../application/ListTodos');
const { ResolveMcpApiKeyPrincipal } = require('../../application/ResolveMcpApiKeyPrincipal');
const SetTodoCompletion = require('../../application/SetTodoCompletion');
const SearchTodos = require('../../application/SearchTodos');
const UpdateTodo = require('../../application/UpdateTodo');
const TypeORMTodoRepository = require('../../infrastructure/TypeORMTodoRepository');
const TypeORMMcpApiKeyRepository = require('../../infrastructure/TypeORMMcpApiKeyRepository');
const TypeORMUserRepository = require('../../infrastructure/TypeORMUserRepository');
const { requireInternalServiceAuth } = require('../../middleware/requireInternalServiceAuth');
const { createInternalMcpAuthRouter } = require('./authRouter');
const { createInternalMcpTaskReadRouter } = require('./taskReadRouter');
const { createInternalMcpTaskWriteRouter } = require('./taskWriteRouter');

function createInternalMcpRouter(dependencies = {}) {
  const router = express.Router();
  const todoRepository = dependencies.todoRepository || new TypeORMTodoRepository();
  const mcpApiKeyRepository = dependencies.mcpApiKeyRepository || TypeORMMcpApiKeyRepository;
  const userRepository = dependencies.userRepository || TypeORMUserRepository;
  const createTodo = dependencies.createTodo || new CreateTodo(todoRepository);
  const createTodoForInternalMcp = dependencies.createTodoForInternalMcp
    || new CreateTodoForInternalMcp({ userRepository, todoRepository, createTodo });
  const updateTodo = dependencies.updateTodo || new UpdateTodo(todoRepository);
  const deleteTodo = dependencies.deleteTodo || new DeleteTodo(todoRepository);
  const setTodoCompletion = dependencies.setTodoCompletion || new SetTodoCompletion(todoRepository);
  const resolveMcpApiKeyPrincipal = dependencies.resolveMcpApiKeyPrincipal
    || new ResolveMcpApiKeyPrincipal({ mcpApiKeyRepository, userRepository });
  const searchTodos = dependencies.searchTodos || new SearchTodos(todoRepository);
  const listTodos = dependencies.listTodos || new ListTodos(todoRepository);

  router.use(requireInternalServiceAuth());

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'internal-mcp',
      authenticatedService: req.internalServiceAuth?.service || null,
    });
  });

  router.use('/auth', createInternalMcpAuthRouter({
    resolveMcpApiKeyPrincipal,
  }));

  router.use('/tasks', createInternalMcpTaskReadRouter({
    todoRepository,
    searchTodos,
    listTodos,
    getNow: dependencies.getNow,
  }));

  router.use('/tasks', createInternalMcpTaskWriteRouter({
    todoRepository,
    createTodoForInternalMcp,
    updateTodo,
    deleteTodo,
    setTodoCompletion,
  }));

  return router;
}

module.exports = {
  createInternalMcpRouter,
};
