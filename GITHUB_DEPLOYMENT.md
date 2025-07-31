# Direct GitHub Deployment to Cloudways

## Option 1: Using Cloudways Git Deployment

1. **Access Cloudways Dashboard**
   - Login to your Cloudways account
   - Select your application/server

2. **Enable Git Deployment**
   - Go to "Deployment via Git" section
   - Add repository: `git@github.com:m-7labs/solitaire.git`
   - Set branch: `main`
   - Set deployment path: `public_html` (or your domain folder)

3. **Deploy**
   - Click "Deploy Now"
   - Set up webhook for auto-deployment (optional)

## Option 2: Manual SSH Deployment

If Git deployment isn't available, use SSH:

```bash
# SSH into your Cloudways server
ssh user@your-server-ip

# Navigate to your domain folder
cd /var/www/html/public_html

# Clone your repository
git clone https://github.com/m-7labs/solitaire.git .

# Or if already cloned, just pull updates
git pull origin main
```

## Option 3: Cloudways CLI

Install Cloudways CLI and deploy:

```bash
# Install Cloudways CLI
npm install -g @cloudways/cli

# Login
cw login

# Deploy from GitHub
cw app deploy --git-url https://github.com/m-7labs/solitaire.git --branch main
```

## Option 4: GitHub Actions (Advanced)

Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy to Cloudways
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy via SSH
      uses: appleboy/ssh-action@v0.1.2
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.KEY }}
        script: |
          cd /var/www/html/public_html
          git pull origin main
```

## Benefits of GitHub Deployment

✅ **Version Control**: Easy rollbacks and updates
✅ **Automation**: Auto-deploy on code changes  
✅ **Multiple Domains**: Deploy to different servers/domains
✅ **Collaboration**: Team members can deploy updates
✅ **Backup**: Code always backed up on GitHub

## For Multiple Domains

1. **Same Repository, Multiple Deployments:**
   - Set up Git deployment for each domain
   - Each domain pulls from the same repository
   - Customize `index.html` per domain after deployment

2. **Branch-based Deployment:**
   - Create branches for different domains: `domain1`, `domain2`
   - Each domain deploys from its specific branch
   - Customize each branch for different branding

## Quick Setup Steps

1. **Check Cloudways Git Support:**
   - Login to Cloudways
   - Look for "Git Deployment" in your app settings

2. **If Available:**
   - Add your GitHub repository URL
   - Set up SSH key or use HTTPS with token
   - Configure auto-deployment webhook

3. **If Not Available:**
   - Use SSH method to clone repository manually
   - Set up a script to pull updates when needed

This approach is much cleaner than manual file uploads and gives you proper version control and deployment automation!
