# Lifeline Quick Start

## Local development

### Backend
```bash
cd backend
npm install
npm run dev
```

Backend default URL: `http://localhost:3000`

### Frontend
```bash
cd client
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

## Production deployment model

- `main` is the normal development branch.
- `deploy` is the production deployment branch.
- pushing to `deploy` triggers the VPS deployment workflow.

See [DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md) for production deployment details.

## Documentation entrypoints

- Docs overview: [../README.md](../README.md)
- Testing reference: [../reference/TESTING_CHECKLIST.md](../reference/TESTING_CHECKLIST.md)
- Feature inventory: [../features/FEATURES.md](../features/FEATURES.md)