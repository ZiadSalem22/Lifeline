# Lifeline

This repository contains the Lifeline full-stack application (frontend + backend).

Quick start

- Install dependencies:
  - Backend: `cd backend` then `npm install`
  - Frontend: `cd frontend` then `npm install`

- Run locally:
  - Backend dev: `cd backend; npm run dev`
  - Frontend dev: `cd frontend; npm run dev`

Notes for GitHub submission

1. I have added a `.gitignore` to exclude `node_modules`, build outputs, OS/editor files, and the SQLite DB file (`todos_v4.db`).
2. To push this repo to GitHub, create a remote repository on GitHub, then run:

```powershell
cd C:\Users\ziyad\testground
git remote add origin <your-remote-url>
git branch -M main
git push -u origin main
```

Replace `<your-remote-url>` with the SSH or HTTPS URL provided by GitHub (for example `git@github.com:username/lifeline.git` or `https://github.com/username/lifeline.git`).

If you want me to add the remote and push for you, I can run those commands — but you'll need to provide the remote URL and ensure credentials are available in this environment.

License

Add a `LICENSE` file if you'd like a specific license. Common choices: MIT, Apache-2.0.

Contact

If you'd like, I can also:
- Create a `LICENSE` file
- Create GitHub Actions workflow for CI
- Create repository topics and a descriptive `DESCRIPTION` file

