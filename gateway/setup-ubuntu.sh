#!/bin/bash

# 🚀 WhatsApp SaaS Gateway - Ubuntu Setup Script
# This script will install and configure the WhatsApp SaaS system on Ubuntu

set -e

echo "🐧 بدء إعداد WhatsApp SaaS Gateway على Ubuntu..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "لا تشغل هذا السكريبت كـ root! استخدم مستخدم عادي مع sudo"
fi

# Update system
log "تحديث النظام..."
sudo apt update && sudo apt upgrade -y

# Install basic requirements
log "تثبيت المتطلبات الأساسية..."
sudo apt install -y curl git wget unzip bc jq nginx ufw certbot python3-certbot-nginx

# Install Node.js 18
log "تثبيت Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker
log "تثبيت Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    log "Docker تم تثبيته بنجاح"
else
    log "Docker مثبت بالفعل"
fi

# Install Docker Compose
log "تثبيت Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log "Docker Compose تم تثبيته بنجاح"
else
    log "Docker Compose مثبت بالفعل"
fi

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Verify installations
log "التحقق من التثبيت..."
node --version
docker --version
docker-compose --version

# Create project directory
PROJECT_DIR="/opt/whatsapp-saas"
log "إنشاء مجلد المشروع: $PROJECT_DIR"
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR

# Ask for domain name
read -p "أدخل اسم النطاق (domain) الخاص بك (اختياري): " DOMAIN_NAME

# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
WEBHOOK_SECRET=$(openssl rand -base64 32)
API_KEY_SECRET=$(openssl rand -base64 32)

log "تم إنشاء كلمات مرور آمنة..."

# Create .env file
log "إنشاء ملف .env..."
cat > $PROJECT_DIR/.env << EOF
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=whatsapp_saas
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

# JWT
JWT_SECRET=$JWT_SECRET

# API Keys
API_KEY_ENCRYPTION_KEY=$API_KEY_SECRET

# Webhook
WEBHOOK_SECRET=$WEBHOOK_SECRET

# Docker
DOCKER_HOST=unix:///var/run/docker.sock
INSTANCE_PORT_RANGE_START=4000
INSTANCE_PORT_RANGE_END=4999

# Production settings
NODE_ENV=production
PORT=3000
SESSION_AUTH_PORT=3001

# Instance limits
MAX_INSTANCES_PER_USER=10
INSTANCE_TIMEOUT=3600000
AUTO_CLEANUP_INTERVAL=300000

# Domain
DOMAIN_NAME=$DOMAIN_NAME
EOF

# Copy current project files
log "نسخ ملفات المشروع..."
if [[ -d "gateway" ]]; then
    cp -r gateway/* $PROJECT_DIR/
    log "تم نسخ ملفات Gateway"
else
    warn "مجلد gateway غير موجود، تأكد من تشغيل السكريبت من مجلد المشروع الرئيسي"
fi

# Update docker-compose.yml with new passwords
log "تحديث docker-compose.yml..."
sed -i "s/POSTGRES_PASSWORD: postgres123/POSTGRES_PASSWORD: $DB_PASSWORD/" $PROJECT_DIR/docker-compose.yml
sed -i "s/redis-server --appendonly yes --requirepass redis123/redis-server --appendonly yes --requirepass $REDIS_PASSWORD/" $PROJECT_DIR/docker-compose.yml
sed -i "s/DB_PASSWORD: postgres123/DB_PASSWORD: $DB_PASSWORD/" $PROJECT_DIR/docker-compose.yml
sed -i "s/REDIS_PASSWORD: redis123/REDIS_PASSWORD: $REDIS_PASSWORD/" $PROJECT_DIR/docker-compose.yml

# Setup firewall
log "إعداد Firewall..."
sudo ufw --force enable
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000
sudo ufw allow 3001

# Setup SSL if domain provided
if [[ ! -z "$DOMAIN_NAME" ]]; then
    log "إعداد SSL لـ $DOMAIN_NAME..."
    
    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/whatsapp-saas > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    
    # Temporary location for SSL challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/whatsapp-saas /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    
    # Get SSL certificate
    if sudo certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email admin@$DOMAIN_NAME; then
        log "SSL تم إعداده بنجاح"
        
        # Update Nginx with full configuration
        sudo tee /etc/nginx/sites-available/whatsapp-saas > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;
    
    # API Gateway
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Session Auth
    location /session/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health Check
    location /health {
        proxy_pass http://localhost:3000;
    }
    
    # Websocket support
    location /ws/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF
        sudo nginx -t && sudo systemctl reload nginx
    else
        warn "فشل في إعداد SSL، سيتم استخدام HTTP"
    fi
fi

# Create systemd service
log "إنشاء خدمة systemd..."
sudo tee /etc/systemd/system/whatsapp-saas.service > /dev/null << EOF
[Unit]
Description=WhatsApp SaaS Gateway
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0
User=$USER
Group=$USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable whatsapp-saas

# Create monitoring script
log "إنشاء سكريبت المراقبة..."
sudo mkdir -p /var/log/whatsapp-saas
sudo chown $USER:$USER /var/log/whatsapp-saas

cat > $PROJECT_DIR/monitor.sh << 'EOF'
#!/bin/bash
LOG_FILE="/var/log/whatsapp-saas/health.log"
API_URL="http://localhost:3000/health"

if curl -f -s $API_URL > /dev/null; then
    echo "$(date): System is healthy" >> $LOG_FILE
else
    echo "$(date): System is down! Restarting..." >> $LOG_FILE
    cd /opt/whatsapp-saas
    docker-compose restart
fi

MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

echo "$(date): Memory: ${MEMORY_USAGE}%, Disk: ${DISK_USAGE}%" >> $LOG_FILE

if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    echo "$(date): WARNING: High memory usage: ${MEMORY_USAGE}%" >> $LOG_FILE
fi
EOF

chmod +x $PROJECT_DIR/monitor.sh

# Add to cron
(crontab -l 2>/dev/null; echo "*/5 * * * * $PROJECT_DIR/monitor.sh") | crontab -

# Create backup script
log "إنشاء سكريبت النسخ الاحتياطي..."
sudo mkdir -p /opt/backups/whatsapp-saas
sudo chown $USER:$USER /opt/backups/whatsapp-saas

cat > $PROJECT_DIR/backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/opt/backups/whatsapp-saas"
DATE=\$(date +%Y%m%d_%H%M%S)

cd $PROJECT_DIR

# Database backup
docker-compose exec -T postgres pg_dump -U postgres whatsapp_saas > \$BACKUP_DIR/db_\$DATE.sql

# Sessions backup
tar -czf \$BACKUP_DIR/sessions_\$DATE.tar.gz storage/sessions/

# Config backup
cp .env \$BACKUP_DIR/env_\$DATE.backup

# Cleanup old backups (30 days)
find \$BACKUP_DIR -name "*.sql" -mtime +30 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find \$BACKUP_DIR -name "*.backup" -mtime +30 -delete

echo "\$(date): Backup completed" >> /var/log/whatsapp-saas/backup.log
EOF

chmod +x $PROJECT_DIR/backup.sh

# Add daily backup to cron
(crontab -l 2>/dev/null; echo "0 2 * * * $PROJECT_DIR/backup.sh") | crontab -

# Setup log rotation
sudo tee /etc/logrotate.d/whatsapp-saas > /dev/null << EOF
/var/log/whatsapp-saas/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $USER
}
EOF

# Start the system
log "بدء تشغيل النظام..."
cd $PROJECT_DIR

# Build and start services
docker-compose build
docker-compose up -d

# Wait for services to be ready
log "انتظار تشغيل الخدمات..."
sleep 30

# Check health
if curl -f -s http://localhost:3000/health > /dev/null; then
    log "✅ النظام يعمل بنجاح!"
else
    warn "❌ النظام لم يبدأ بشكل صحيح، فحص logs:"
    docker-compose logs
fi

# Create test user
log "إنشاء مستخدم تجريبي..."
sleep 10
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@'$DOMAIN_NAME'",
    "password": "admin123456",
    "name": "System Admin"
  }' 2>/dev/null || warn "فشل في إنشاء المستخدم التجريبي"

# Create summary
log "إنشاء ملخص التثبيت..."
cat > $PROJECT_DIR/INSTALLATION_SUMMARY.md << EOF
# 🎉 ملخص التثبيت - WhatsApp SaaS Gateway

## ✅ تم التثبيت بنجاح!

### 🔗 الروابط
- **API Gateway**: http://localhost:3000
- **Session Auth**: http://localhost:3001
- **Health Check**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000/api-docs

$(if [[ ! -z "$DOMAIN_NAME" ]]; then
echo "- **Domain**: https://$DOMAIN_NAME"
echo "- **SSL**: مُفعل"
fi)

### 🔐 معلومات قاعدة البيانات
- **Database**: whatsapp_saas
- **User**: postgres
- **Password**: $DB_PASSWORD

### 🧪 مستخدم تجريبي
- **Email**: admin@$DOMAIN_NAME
- **Password**: admin123456

### 📁 مجلدات مهمة
- **Project**: $PROJECT_DIR
- **Logs**: /var/log/whatsapp-saas
- **Backups**: /opt/backups/whatsapp-saas

### 🛠️ الأوامر المفيدة
\`\`\`bash
# إيقاف/تشغيل النظام
sudo systemctl stop whatsapp-saas
sudo systemctl start whatsapp-saas

# مشاهدة logs
docker-compose logs -f

# إعادة تشغيل خدمة معينة
docker-compose restart gateway_api

# فحص الصحة
curl http://localhost:3000/health
\`\`\`

### 🔄 التحديث
\`\`\`bash
cd $PROJECT_DIR
git pull origin main
docker-compose build
docker-compose up -d
\`\`\`

تم إنشاء هذا الملخص في: $(date)
EOF

echo ""
echo "🎉 تم إعداد WhatsApp SaaS Gateway بنجاح!"
echo ""
echo "📋 الخطوات التالية:"
echo "   1. راجع الملف: $PROJECT_DIR/INSTALLATION_SUMMARY.md"
echo "   2. اختبر النظام: curl http://localhost:3000/health"
echo "   3. سجل دخول المستخدم التجريبي"
echo "   4. اقرأ دليل الاستخدام: $PROJECT_DIR/README.md"
echo ""
if [[ ! -z "$DOMAIN_NAME" ]]; then
echo "🌐 النطاق الخاص بك: https://$DOMAIN_NAME"
fi
echo ""
echo "🔧 للدعم الفني، راجع: $PROJECT_DIR/UBUNTU_DEPLOYMENT.md"
echo "✅ النظام جاهز للاستخدام!"