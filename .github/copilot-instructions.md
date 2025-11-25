# Copilot Instructions for Lifeline Project

This document provides essential guidance for AI coding agents working on the "Lifeline" project. It outlines the project's architecture, critical development workflows, and specific conventions to ensure immediate productivity and adherence to established patterns.

## 1. Project Overview & Architecture

Lifeline is a full-stack application with a clear separation between its backend (Node.js/Express) and frontend (React/Vite).

### 1.1 Backend Architecture (`backend/`)
The backend adheres to a "Clean Architecture" or "Hexagonal Architecture" style, promoting separation of concerns and testability.

*   **Entry Point:** `backend/src/index.js` - Initializes the Express application, middleware, database, and registers routes.
*   **Layers:**
    *   `infrastructure/`: Contains concrete implementations for data persistence, specifically `SQLiteTodoRepository.js` and `SQLiteTagRepository.js` for SQLite database interactions.
    *   `domain/`: Defines core business entities (`Todo.js`, `Tag.js`) and interfaces (`ITodoRepository.js`).
    *   `application/`: Encapsulates business logic through use case classes (e.g., `CreateTodo.js`, `ListTodos.js`, `TagUseCases.js`). These use cases interact with domain entities and repository interfaces.
    *   `controllers/`: (Implicitly handled in `index.js` currently, but conceptually distinct) Responsible for handling HTTP requests and delegating to application use cases.
    *   `routes/`: (Implicitly handled in `index.js` currently) Defines API endpoints.
    *   `middleware/`: Contains Express middleware for request processing (e.g., `errorHandler.js`, `requestLogger.js`, `validate.js`).
*   **Database:** SQLite (`todos_v4.db`). Database initialization and table creation (`todos`, `tags`, `todo_tags`) occur in `backend/src/index.js`.
*   **Dependencies:** Express, Cors, Body-Parser, SQLite3, Joi (for validation), Winston (for logging), UUID.

### 1.2 Frontend Architecture (`client/`)
The frontend is a modern React application built with Vite, following a component-based architecture.

*   **Entry Point:** `client/index.html` (mounts to `<div id="root"></div>`) which loads `client/src/app/main.jsx`. That file renders the main `App` component.
*   **Core Component:** `client/src/app/App.jsx` - Manages global application state (todos, tags, theme, selected dates), handles API interactions, and orchestrates the rendering of major UI components.
*   **API Integration:** `client/src/utils/api.js` - Centralizes all communication with the backend API. It provides asynchronous functions for fetching, creating, updating, and deleting todos and tags.
*   **Components:** Modular React components grouped under `client/src/components/*` (e.g., `layout/Sidebar.jsx`, `settings/Settings.jsx`, `background/CosmicBackground.jsx`).
*   **Styling:** Consolidated global CSS in `client/src/styles/base.css` (plus `cosmic-background.css`) along with inline styles. `framer-motion` is used for animations.
*   **Dependencies:** React, React-DOM, Vite, Date-fns, Framer-Motion, React-Calendar.

## 2. Critical Developer Workflows

### 2.1 Backend Commands (from `backend/package.json`)
*   **Install Dependencies:** Run `npm install` in the `backend/` directory.
*   **Start Development Server:** `npm run dev` (uses `nodemon src/index.js` for hot-reloading).
*   **Start Production Server:** `npm start` (uses `node src/index.js`).
*   **Run Tests:** `npm test` (uses `jest`).

### 2.2 Frontend Commands (from `client/package.json`)
*   **Install Dependencies:** Run `npm install` in the `client/` directory.
*   **Start Development Server:** `npm run dev` (uses `vite`).
*   **Build for Production:** `npm run build` (uses `vite build`).
*   **Run Linter:** `npm run lint` (uses `eslint .`).
*   **Preview Production Build:** `npm run preview` (uses `vite preview`).

## 3. Project-Specific Conventions and Patterns

### 3.1 Data Flow
*   **Frontend to Backend:** User actions -> `client/src/utils/api.js` functions -> HTTP requests to `http://localhost:3000/api/todos` or `http://localhost:3000/api/tags`.
*   **Backend Processing:** Express routes -> Use Case classes (`backend/src/application/`) -> Repository interfaces -> Repository implementations (`backend/src/infrastructure/`) -> SQLite database.
*   **Error Handling:** Backend uses `try-catch` in route handlers, returning JSON error objects with appropriate HTTP status codes. Frontend checks `response.ok` in `api.js` and logs errors to console in `App.jsx`.

### 3.2 Validation
*   **Backend:** Uses `joi` for robust input validation. Schemas are expected to be defined within `backend/src/validators/` or related use cases.
*   **Frontend:** Performs basic client-side validation (e.g., non-empty input).

### 3.3 Logging
*   **Backend:** Configured to use `winston` (see `backend/src/config/logger.js`). Currently, `console.log` is used for server start; integrate Winston for comprehensive error and activity logging.

### 3.4 Styling
*   **Frontend:** Combines global CSS (`theme.css`, `responsive.css`) and extensive inline styling within JSX components. `framer-motion` is used for UI animations. When adding new components, prefer a mix of global styles (for common elements) and inline styles (for unique component-level presentation and animations).

## 4. Integration Points

*   **API Endpoints:** The frontend communicates exclusively with the backend via `/api/todos` and `/api/tags` endpoints served by the Node.js Express server on `http://localhost:3000`.
*   **Database:** SQLite database file `todos_v4.db` is managed by the backend.

## 5. Key Files/Directories

*   `backend/src/index.js`: Backend entry point, routing, middleware, DB setup.
*   `backend/src/application/`: Backend business logic (use cases).
*   `backend/src/domain/`: Backend domain entities and interfaces.
*   `backend/src/infrastructure/`: Backend data persistence implementations.
*   `client/src/app/App.jsx`: Main frontend component, state management.
*   `client/src/utils/api.js`: Centralized frontend API calls.
*   `client/src/styles/base.css`: Consolidated global frontend styles (includes previous theme/responsive rules).

This document serves as a foundational guide. Always refer to the actual code for the most up-to-date and detailed implementation specifics.