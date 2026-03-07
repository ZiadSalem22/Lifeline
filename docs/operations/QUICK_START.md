# Lifeline Quick Start

## Local development

### Split frontend/backend workflow

#### Backend

```bash
cd backend
npm install
npm run dev
```

Backend default URL: `http://localhost:3000`

#### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

Vite proxies `/api` to the backend dev server by default.

### Local compose workflow

Use the root compose file when you want a containerized local runtime with PostgreSQL and the combined app image.

Default app URL: `http://localhost:3020`

## Production deployment model

- `main` is the normal development branch.
- `deploy` is the production deployment branch.
- pushing to `deploy` triggers the VPS deployment workflow.

See [DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md) for production deployment details.

## Documentation entrypoints

- Docs overview: [../README.md](../README.md)
- Feature inventory: [../features/FEATURES.md](../features/FEATURES.md)
- Local runtime guide: [local-development-and-runtime-setup.md](local-development-and-runtime-setup.md)
- Production runtime guide: [production-runtime-and-rollback.md](production-runtime-and-rollback.md)
- Verification guide: [deployment-verification-and-smoke-checks.md](deployment-verification-and-smoke-checks.md)