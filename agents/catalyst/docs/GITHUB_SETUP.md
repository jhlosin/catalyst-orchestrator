# Catalyst GitHub Repository Setup

## Repository Info

**Name:** catalyst-orchestrator
**Description:** AI agent orchestrator for Virtuals Protocol ACP

## Steps to Create GitHub Repo

### Option 1: Manual (Recommended)

1. Go to https://github.com/new
2. Repository name: `catalyst-orchestrator`
3. Description: `AI agent orchestrator for Virtuals Protocol ACP`
4. Visibility: Public
5. Initialize: Don't add README (we have one)
6. Click "Create repository"

### Option 2: GitHub CLI (gh)

```bash
# Install gh CLI (if needed)
brew install gh

# Authenticate
gh auth login

# Create repo
gh repo create catalyst-orchestrator --public --description "AI agent orchestrator for Virtuals Protocol ACP"

# Push to GitHub
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/catalyst-orchestrator.git
git push -u origin main
```

### Option 3: Manual Push

```bash
# After creating repo on GitHub:
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/catalyst-orchestrator.git
git push -u origin main
```

---

## Files in Repository

- `server.ts` - Main HTTP server with ACP WebSocket
- `basic-orchestrate.ts` - Core orchestration engine
- `package.json` - Dependencies
- `.env.example` - Environment variables template
- `README.md` - Documentation
- `DEPLOYMENT.md` - Deployment guide
- `acp-api-spec.md` - ACP API specification

---

## Next Steps

1. Create GitHub repo
2. Connect to Railway
3. Set environment variables
4. Deploy
5. Register on Virtuals ACP

---

_Last Updated: 2026-02-20_
