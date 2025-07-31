#!/bin/bash

# Solitaire Game Deployment Package Creator
# This script creates a production-ready package for web hosting

echo "Creating Solitaire Game Deployment Package..."

# Create deployment directory
DEPLOY_DIR="solitaire-deployment-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy game files
echo "Copying game files..."
cp index.html "$DEPLOY_DIR/"
cp -r src "$DEPLOY_DIR/"
cp README.md "$DEPLOY_DIR/"

# Create .htaccess for Apache servers (common on shared hosting)
cat > "$DEPLOY_DIR/.htaccess" << 'EOF'
# Enable GZIP compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Set cache headers for static assets
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType text/javascript "access plus 1 month"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/jpg "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
    ExpiresByType image/svg+xml "access plus 1 month"
</IfModule>

# Security headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"

# Redirect to HTTPS (uncomment if using SSL)
# RewriteEngine On
# RewriteCond %{HTTPS} off
# RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Set index.html as default document
DirectoryIndex index.html
EOF

# Create robots.txt
cat > "$DEPLOY_DIR/robots.txt" << 'EOF'
User-agent: *
Allow: /

Sitemap: https://yourdomain.com/sitemap.xml
EOF

# Create a simple sitemap.xml
cat > "$DEPLOY_DIR/sitemap.xml" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yourdomain.com/</loc>
    <lastmod>2025-07-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
EOF

# Create deployment instructions
cat > "$DEPLOY_DIR/DEPLOYMENT_INSTRUCTIONS.txt" << 'EOF'
SOLITAIRE GAME DEPLOYMENT INSTRUCTIONS
======================================

CLOUDWAYS HOSTING DEPLOYMENT:

1. LOGIN TO CLOUDWAYS:
   - Go to https://www.cloudways.com
   - Login to your account
   - Select your application/server

2. ACCESS FILE MANAGER:
   - Go to your application dashboard
   - Click on "File Manager" or use SFTP

3. UPLOAD FILES:
   - Navigate to public_html folder (or your domain's document root)
   - Upload ALL files from this deployment package
   - Ensure file permissions are set correctly (644 for files, 755 for directories)

4. CONFIGURE DOMAIN:
   - Make sure your domain points to the correct directory
   - Ensure index.html is set as the default document
   - Enable SSL certificate for HTTPS

5. TEST:
   - Visit your domain: https://yourdomain.com
   - Test the game functionality
   - Check on mobile devices
   - Verify all features work

MULTIPLE DOMAINS:
- Repeat steps 3-5 for each domain
- You can copy the same files to multiple domain folders
- Each domain will have its own independent game instance

CUSTOMIZATION FOR EACH DOMAIN:
- Edit index.html to change title, colors, or branding
- Modify the CSS section for different themes
- Update sitemap.xml with correct domain names

TROUBLESHOOTING:
- If modules don't load: Check that JavaScript is enabled and ES6 modules are supported
- If styles are broken: Verify all files uploaded correctly
- If game doesn't work: Check browser console for errors

PERFORMANCE OPTIMIZATION:
- Enable Cloudways CDN for faster loading
- Use Cloudways caching features
- Enable GZIP compression (included in .htaccess)

MAINTENANCE:
- Game requires no database or server-side processing
- Updates only require re-uploading modified files
- All game state is stored in browser localStorage

SUPPORT:
- Check browser compatibility (modern browsers required)
- Ensure HTTPS is properly configured
- Test mobile responsiveness
EOF

# Create a zip file for easy upload
if command -v zip &> /dev/null; then
    echo "Creating zip file for easy upload..."
    cd "$DEPLOY_DIR"
    zip -r "../${DEPLOY_DIR}.zip" .
    cd ..
    echo "Created ${DEPLOY_DIR}.zip for easy upload to hosting"
fi

echo "Deployment package created successfully!"
echo "Directory: $DEPLOY_DIR"
echo ""
echo "FILES INCLUDED:"
echo "- index.html (main game file)"
echo "- src/ directory (JavaScript modules)"
echo "- .htaccess (Apache configuration)"
echo "- robots.txt (SEO)"
echo "- sitemap.xml (SEO)"
echo "- README.md (documentation)"
echo "- DEPLOYMENT_INSTRUCTIONS.txt (detailed setup guide)"
if [ -f "${DEPLOY_DIR}.zip" ]; then
    echo "- ${DEPLOY_DIR}.zip (complete package for upload)"
fi
echo ""
echo "NEXT STEPS:"
echo "1. Upload the contents to your Cloudways hosting public_html folder"
echo "2. Configure your domain settings"
echo "3. Enable SSL/HTTPS"
echo "4. Test the game on your domain"
echo ""
echo "For multiple domains, copy the same files to each domain's folder."
