---
description: Scaffolds a full-stack Node.js and React Todo application without permission prompts
---

This workflow sets up a full-stack application with a Node.js/Express backend and a React/Vite frontend.

// turbo-all
1. Create the project structure
   - Command: `mkdir todo-app`
   - Command: `mkdir todo-app\server`
   - Command: `mkdir todo-app\client`

2. Set up the Server (Backend)
   - Command: `npm init -y` (in todo-app/server)
   - Command: `npm install express cors mongoose dotenv` (in todo-app/server)

3. Set up the Client (Frontend)
   - Command: `npx -y create-vite@latest . --template react` (in todo-app/client)
   - Command: `npm install` (in todo-app/client)
