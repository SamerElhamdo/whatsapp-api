# 🐧 دليل النشر على Ubuntu Server

## 📋 تحضير السيرفر

### 1. تحديث النظام
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. تثبيت المتطلبات الأساسية
```bash
# تثبيت curl و git
sudo apt install -y curl git wget

# تثبيت Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# تثبيت Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# تثبيت Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# إعادة تشغيل للحصول على صلاحيات Docker
sudo systemctl enable docker
sudo systemctl start docker
```

### 3. تحقق من التثبيت
```bash
node --version     # يجب أن يكون >= 18.0.0
docker --version   # يجب أن يكون >= 20.0.0
docker-compose --version  # يجب أن يكون >= 2.0.0
```

## 🔧 إعداد المشروع

### 1. استنساخ المشروع
```bash
# انتقل إلى مجلد المشاريع
cd /opt
sudo mkdir whatsapp-saas
sudo chown $USER:$USER whatsapp-saas
cd whatsapp-saas

# استنساخ المشروع (استبدل بالرابط الصحيح)
git clone your-repository-url .
```

### 2. إعداد متغيرات البيئة للإنتاج
```bash
cd gateway
cp .env.example .env
nano .env
```

### 3. ملف `.env` للإنتاج:
```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=whatsapp_saas
DB_USER=postgres
DB_PASSWORD=SuperSecurePassword123!

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=RedisSecurePassword456!

# JWT
JWT_SECRET=your-super-secure-jwt-secret-key-256-bits-min

# API Keys
API_KEY_ENCRYPTION_KEY=your-api-key-encryption-secret

# Webhook
WEBHOOK_SECRET=your-webhook-secret-key

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

# SSL/TLS (إذا كنت تستخدم HTTPS)
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/your-cert.pem
SSL_KEY_PATH=/etc/ssl/private/your-key.pem
```

### 4. تحديث كلمات المرور في docker-compose
```bash
nano docker-compose.yml
```

عدّل كلمات المرور في:
- `POSTGRES_PASSWORD`
- `redis-server --requirepass`
- متغيرات البيئة الأخرى

## 🚀 تشغيل النظام

### 1. بناء وتشغيل الخدمات
```bash
# بناء الصور
docker-compose build

# تشغيل الخدمات
docker-compose up -d

# متابعة العمليات
docker-compose logs -f
```

### 2. التحقق من التشغيل
```bash
# فحص الخدمات
docker-compose ps

# فحص صحة النظام
curl http://localhost:3000/health

# فحص قاعدة البيانات
docker-compose exec postgres psql -U postgres -d whatsapp_saas -c "SELECT COUNT(*) FROM users;"
```

## 🔐 الأمان والحماية

### 1. إعداد Firewall
```bash
# تفعيل UFW
sudo ufw enable

# فتح البورتات المطلوبة
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 3000  # Gateway API
sudo ufw allow 3001  # Session Auth

# حماية بورتات Docker (اختياري)
sudo ufw deny 5432   # PostgreSQL
sudo ufw deny 6379   # Redis
```

### 2. إعداد SSL مع Let's Encrypt
```bash
# تثبيت Certbot
sudo apt install -y certbot python3-certbot-nginx

# الحصول على شهادة SSL
sudo certbot --nginx -d your-domain.com

# تجديد تلقائي
sudo crontab -e
# أضف هذا السطر:
0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. إعداد Nginx كـ Reverse Proxy
```bash
sudo apt install -y nginx

# ملف إعداد Nginx
sudo nano /etc/nginx/sites-available/whatsapp-saas
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # API Gateway
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Session Auth
    location /session/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health Check
    location /health {
        proxy_pass http://localhost:3000;
    }
}
```

```bash
# تفعيل الموقع
sudo ln -s /etc/nginx/sites-available/whatsapp-saas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 📊 مراقبة النظام

### 1. إعداد Systemd Service
```bash
sudo nano /etc/systemd/system/whatsapp-saas.service
```

```ini
[Unit]
Description=WhatsApp SaaS Gateway
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/whatsapp-saas/gateway
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-saas
sudo systemctl start whatsapp-saas
```

### 2. إعداد مراقبة Logs
```bash
# إنشاء مجلد logs
sudo mkdir -p /var/log/whatsapp-saas

# إعداد log rotation
sudo nano /etc/logrotate.d/whatsapp-saas
```

```
/var/log/whatsapp-saas/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

### 3. سكريبت مراقبة
```bash
nano /opt/whatsapp-saas/monitor.sh
```

```bash
#!/bin/bash
# مراقبة صحة النظام

LOG_FILE="/var/log/whatsapp-saas/health.log"
API_URL="http://localhost:3000/health"

# فحص صحة API
if curl -f -s $API_URL > /dev/null; then
    echo "$(date): System is healthy" >> $LOG_FILE
else
    echo "$(date): System is down! Restarting..." >> $LOG_FILE
    cd /opt/whatsapp-saas/gateway
    docker-compose restart
fi

# فحص استهلاك الموارد
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

echo "$(date): Memory: ${MEMORY_USAGE}%, Disk: ${DISK_USAGE}%" >> $LOG_FILE

# تنبيه إذا كان الاستهلاك عالي
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    echo "$(date): WARNING: High memory usage: ${MEMORY_USAGE}%" >> $LOG_FILE
fi
```

```bash
chmod +x /opt/whatsapp-saas/monitor.sh

# إضافة إلى cron
crontab -e
# أضف:
*/5 * * * * /opt/whatsapp-saas/monitor.sh
```

## 🔧 الصيانة والتحديث

### 1. النسخ الاحتياطي
```bash
# سكريبت النسخ الاحتياطي
nano /opt/whatsapp-saas/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/whatsapp-saas"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# نسخ قاعدة البيانات
docker-compose exec -T postgres pg_dump -U postgres whatsapp_saas > $BACKUP_DIR/db_$DATE.sql

# نسخ الجلسات
tar -czf $BACKUP_DIR/sessions_$DATE.tar.gz gateway/storage/sessions/

# نسخ الإعدادات
cp gateway/.env $BACKUP_DIR/env_$DATE.backup

# حذف النسخ القديمة (أكثر من 30 يوم)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### 2. تحديث النظام
```bash
# سكريبت التحديث
nano /opt/whatsapp-saas/update.sh
```

```bash
#!/bin/bash
cd /opt/whatsapp-saas

# إيقاف الخدمات
docker-compose down

# تحديث الكود
git pull origin main

# إعادة البناء
docker-compose build

# تشغيل الخدمات
docker-compose up -d

# فحص الصحة
sleep 30
curl -f http://localhost:3000/health && echo "Update successful!" || echo "Update failed!"
```

## 🎯 اختبار النظام

### 1. اختبار شامل
```bash
# إنشاء مستخدم تجريبي
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# تسجيل الدخول
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' | jq -r '.data.token')

# إنشاء جلسة
SESSION_ID=$(curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_name": "test-session"}' | jq -r '.data.session.id')

# تشغيل Instance
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\"}"
```

## 🌐 توسيع النظام

### للتوسع الأفقي (عدة سيرفرات):

1. **قاعدة بيانات خارجية**: استخدم PostgreSQL مُدار
2. **Redis Cluster**: لتوزيع الذاكرة المؤقتة
3. **Load Balancer**: Nginx أو HAProxy
4. **Container Registry**: Docker Hub أو AWS ECR
5. **Monitoring**: Prometheus + Grafana

### مثال إعداد Docker Swarm:
```bash
# في السيرفر الرئيسي
docker swarm init

# في السيرفرات الأخرى
docker swarm join --token SWMTKN-1-... IP:2377

# نشر الخدمات
docker stack deploy -c docker-compose.yml whatsapp-saas
```

## 📱 الخلاصة

المشروع جاهز تماماً للنشر على Ubuntu Server مع:

✅ **أمان متقدم** - SSL، Firewall، مصادقة قوية  
✅ **مراقبة شاملة** - Logs، Health checks، تنبيهات  
✅ **نسخ احتياطية** - تلقائية ومجدولة  
✅ **توسع سهل** - Docker Swarm، Kubernetes  
✅ **صيانة بسيطة** - سكريبتات تلقائية  

**🚀 النظام جاهز للإنتاج على Ubuntu Server!**