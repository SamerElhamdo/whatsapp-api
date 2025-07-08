# 🚀 WhatsApp SaaS Gateway System

نظام SaaS متطور لإدارة جلسات وحسابات WhatsApp متعدد المستخدمين، قائم على microservices، مع Gateway مركزي وحاويات مستقلة لكل جلسة مستخدم.

## 📋 المحتويات

- [نظرة عامة](#نظرة-عامة)
- [البنية المعمارية](#البنية-المعمارية)
- [المتطلبات](#المتطلبات)
- [التثبيت والتشغيل](#التثبيت-والتشغيل)
- [API Documentation](#api-documentation)
- [أمثلة الاستخدام](#أمثلة-الاستخدام)
- [إعدادات البيئة](#إعدادات-البيئة)
- [النشر](#النشر)

## 🎯 نظرة عامة

### المميزات الرئيسية

✅ **نظام SaaS متكامل** - إدارة متعددة المستخدمين مع اشتراكات وصلاحيات  
✅ **Microservices Architecture** - هيكل قابل للتوسع ومعزول  
✅ **Docker Containerization** - حاويات مستقلة لكل جلسة WhatsApp  
✅ **Gateway API مركزي** - نقطة دخول واحدة لجميع العمليات  
✅ **Session Management** - إدارة متقدمة للجلسات والمصادقة  
✅ **Load Balancing** - توزيع الأحمال تلقائياً  
✅ **Real-time Monitoring** - مراقبة صحة النظام والإحصائيات  
✅ **Webhooks Support** - إشعارات فورية للأحداث  
✅ **API Keys** - مصادقة متعددة الطرق  
✅ **Analytics & Billing** - تتبع الاستخدام والفوترة  

## 🏗️ البنية المعمارية

```
┌─────────────────────────────────────────────────────────────┐
│                    🌐 Client Applications                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                📡 Gateway API (Port 3000)                   │
│  • Authentication & Authorization                           │
│  • Request Routing & Load Balancing                         │
│  • Subscription Management                                  │
│  • Docker Container Orchestration                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
│🔐 Session    │ │📊 Redis │ │💾 PostgreSQL │
│Auth Service  │ │ Cache   │ │  Database    │
│(Port 3001)   │ └─────────┘ └─────────────┘
└──────────────┘
        │
┌───────▼────────────────────────────────────────────────────┐
│            📦 WhatsApp Instance Containers                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Instance 1│ │Instance 2│ │Instance 3│ │Instance N│      │
│  │Port 4000 │ │Port 4001 │ │Port 4002 │ │Port 400N │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└────────────────────────────────────────────────────────────┘
        │
┌───────▼───────┐
│ 🗄️ Storage     │
│ (Sessions)    │
└───────────────┘
```

### المكونات الأساسية

| المكون | الوصف | البورت |
|--------|--------|---------|
| **Gateway API** | نقطة الدخول الرئيسية للنظام | 3000 |
| **Session Auth Service** | خدمة مصادقة الجلسات وQR Codes | 3001 |
| **PostgreSQL** | قاعدة البيانات الرئيسية | 5432 |
| **Redis** | نظام التخزين المؤقت | 6379 |
| **WhatsApp Instances** | حاويات WhatsApp مستقلة | 4000-4999 |

## 📋 المتطلبات

### النظام

- **Node.js** >= 18.0.0
- **Docker** >= 20.0.0
- **Docker Compose** >= 2.0.0
- **PostgreSQL** >= 12
- **Redis** >= 6

### الموارد المقترحة

- **RAM**: 4GB حد أدنى، 8GB مُوصى به
- **CPU**: 2 cores حد أدنى، 4 cores مُوصى به
- **Storage**: 20GB حد أدنى، 100GB للإنتاج
- **Network**: 1Gbps للأداء المثلى

## 🚀 التثبيت والتشغيل

### 1. استنساخ المستودع

```bash
git clone https://github.com/SamerElhamdo/whatsapp-api.git
cd whatsapp-api/gateway
```

### 2. إعداد متغيرات البيئة

```bash
cp .env.example .env
# عدل الملف حسب إعداداتك
nano .env
```

### 3. تشغيل النظام بـ Docker

```bash
# بناء وتشغيل جميع الخدمات
npm run build
npm start

# أو للتطوير
npm run dev
```

### 4. تهيئة قاعدة البيانات

```bash
# تشغيل migrations
npm run db:migrate

# إضافة البيانات الأولية
npm run db:seed
```

### 5. التحقق من التشغيل

```bash
# فحص صحة النظام
curl http://localhost:3000/health

# عرض الخدمات المتاحة
curl http://localhost:3000/
```

## 📚 API Documentation

### المصادقة

#### تسجيل مستخدم جديد

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "phone": "+1234567890"
}
```

#### تسجيل الدخول

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### الحصول على ملف المستخدم

```bash
GET /api/v1/auth/me
Authorization: Bearer YOUR_JWT_TOKEN
```

### إدارة الجلسات

#### إنشاء جلسة جديدة

```bash
POST /api/v1/sessions
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "session_name": "my-whatsapp-session",
  "webhook_url": "https://your-webhook-url.com/webhook",
  "settings": {
    "auto_reply": false,
    "webhook_events": ["message", "status"]
  }
}
```

#### عرض الجلسات

```bash
GET /api/v1/sessions
Authorization: Bearer YOUR_JWT_TOKEN
```

#### حذف جلسة

```bash
DELETE /api/v1/sessions/{session_id}
Authorization: Bearer YOUR_JWT_TOKEN
```

### إدارة الحاويات (Instances)

#### تشغيل instance جديدة

```bash
POST /api/v1/instances
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "session_id": "session-uuid-here"
}
```

#### عرض الحاويات

```bash
GET /api/v1/instances
Authorization: Bearer YOUR_JWT_TOKEN
```

#### إيقاف حاوية

```bash
POST /api/v1/instances/{instance_id}/stop
Authorization: Bearer YOUR_JWT_TOKEN
```

### إرسال الرسائل

#### إرسال رسالة نصية

```bash
POST /api/v1/messages/send
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "session_id": "session-uuid-here",
  "recipient": "1234567890@c.us",
  "message": "Hello from WhatsApp SaaS!",
  "message_type": "text"
}
```

#### عرض سجل الرسائل

```bash
GET /api/v1/messages?page=1&limit=20
Authorization: Bearer YOUR_JWT_TOKEN
```

### إدارة Webhooks

#### إنشاء webhook

```bash
POST /api/v1/webhooks
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "url": "https://your-domain.com/webhook",
  "events": ["message", "status", "qr"],
  "session_id": "session-uuid-here"
}
```

### التحليلات والإحصائيات

#### نظرة عامة على الاستخدام

```bash
GET /api/v1/analytics/overview
Authorization: Bearer YOUR_JWT_TOKEN
```

## 💡 أمثلة الاستخدام

### مثال شامل: إعداد وإرسال رسالة

```javascript
const axios = require('axios')

const API_BASE = 'http://localhost:3000/api/v1'
let authToken = ''

// 1. تسجيل دخول
async function login() {
  const response = await axios.post(`${API_BASE}/auth/login`, {
    email: 'demo@whatsapp-saas.com',
    password: 'demo123'
  })
  
  authToken = response.data.data.token
  console.log('✅ تم تسجيل الدخول')
}

// 2. إنشاء جلسة
async function createSession() {
  const response = await axios.post(`${API_BASE}/sessions`, {
    session_name: 'my-business-whatsapp',
    webhook_url: 'https://my-domain.com/webhook'
  }, {
    headers: { Authorization: `Bearer ${authToken}` }
  })
  
  return response.data.data.session.id
}

// 3. تشغيل instance
async function startInstance(sessionId) {
  const response = await axios.post(`${API_BASE}/instances`, {
    session_id: sessionId
  }, {
    headers: { Authorization: `Bearer ${authToken}` }
  })
  
  console.log('✅ تم تشغيل Instance')
  return response.data.data.instance
}

// 4. إرسال رسالة
async function sendMessage(sessionId) {
  const response = await axios.post(`${API_BASE}/messages/send`, {
    session_id: sessionId,
    recipient: '1234567890@c.us',
    message: 'مرحباً من نظام WhatsApp SaaS!',
    message_type: 'text'
  }, {
    headers: { Authorization: `Bearer ${authToken}` }
  })
  
  console.log('✅ تم إرسال الرسالة')
  return response.data
}

// تشغيل المثال
async function main() {
  try {
    await login()
    const sessionId = await createSession()
    await startInstance(sessionId)
    
    // انتظار تشغيل Instance
    setTimeout(async () => {
      await sendMessage(sessionId)
    }, 5000)
    
  } catch (error) {
    console.error('❌ خطأ:', error.response?.data || error.message)
  }
}

main()
```

### مثال API Key Authentication

```bash
# استخدام API Key بدلاً من JWT
curl -X POST http://localhost:3000/api/v1/messages/send \
  -H "X-API-Key: wsa_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session-uuid",
    "recipient": "1234567890@c.us",
    "message": "Hello via API Key!"
  }'
```

## ⚙️ إعدادات البيئة

### ملف `.env` الكامل

```env
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=whatsapp_saas
DB_USER=postgres
DB_PASSWORD=postgres123

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis123

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# API Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Docker Configuration
DOCKER_HOST=unix:///var/run/docker.sock
WHATSAPP_IMAGE=whatsapp-instance:latest

# Instance Configuration
INSTANCE_PORT_RANGE_START=4000
INSTANCE_PORT_RANGE_END=4999
MAX_INSTANCES_PER_USER=5

# Storage Configuration
SESSION_STORAGE_PATH=/app/storage/sessions
MEDIA_STORAGE_PATH=/app/storage/media

# Security Configuration
WEBHOOK_SECRET=your-webhook-secret-key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_EMAIL_VERIFICATION=false
ENABLE_WEBHOOKS=true
ENABLE_API_KEYS=true
```

## 🔒 الأمان

### أفضل الممارسات

1. **تغيير كلمات المرور الافتراضية**
2. **استخدام HTTPS في الإنتاج**
3. **تفعيل Rate Limiting**
4. **مراقبة الأنشطة المشبوهة**
5. **تحديث النظام دورياً**

### إعدادات الأمان

```env
# تفعيل HTTPS
ENABLE_HTTPS=true
SSL_CERT_PATH=/path/to/ssl/cert.pem
SSL_KEY_PATH=/path/to/ssl/private.key

# تشديد الأمان
BCRYPT_ROUNDS=12
JWT_SECRET=very-long-random-secret-key
WEBHOOK_SECRET=another-very-secure-secret
```

## 📊 المراقبة والإحصائيات

### Health Checks

```bash
# فحص صحة النظام
curl http://localhost:3000/health

# فحص صحة قاعدة البيانات
curl http://localhost:3000/health/database

# إحصائيات النظام
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/v1/analytics/overview
```

### Logs

```bash
# عرض logs مباشر
npm run logs

# logs Gateway API فقط
docker-compose logs -f gateway_api

# logs جميع الخدمات
docker-compose logs -f
```

## 🚀 النشر

### نشر على Docker

```bash
# بناء الصور
docker-compose build

# تشغيل في production
NODE_ENV=production docker-compose up -d

# تحديث الخدمات
docker-compose pull && docker-compose up -d
```

### نشر على Kubernetes

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whatsapp-saas-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: whatsapp-saas-gateway
  template:
    metadata:
      labels:
        app: whatsapp-saas-gateway
    spec:
      containers:
      - name: gateway-api
        image: whatsapp-saas-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
```

## 🔧 التطوير والمساهمة

### إعداد بيئة التطوير

```bash
# تثبيت dependencies
cd gateway/api && npm install
cd ../session-auth && npm install

# تشغيل وضع التطوير
npm run api:dev    # Gateway API
npm run session-auth:dev  # Session Auth Service
```

### تشغيل الاختبارات

```bash
# اختبارات API
npm test

# اختبارات التكامل
npm run test:integration

# تغطية الكود
npm run test:coverage
```

## 📞 الدعم والمساعدة

### الحصول على المساعدة

- 📧 **البريد الإلكتروني**: support@whatsapp-saas.com
- 💬 **Discord**: [رابط Discord](https://discord.gg/whatsapp-saas)
- 📖 **الوثائق**: [docs.whatsapp-saas.com](https://docs.whatsapp-saas.com)
- 🐛 **البلاغات**: [GitHub Issues](https://github.com/SamerElhamdo/whatsapp-api/issues)

### المساهمة

نرحب بجميع المساهمات! 

1. Fork المستودع
2. إنشاء branch جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push للبرنش (`git push origin feature/amazing-feature`)
5. فتح Pull Request

## 📄 الترخيص

هذا المشروع مرخص تحت [MIT License](LICENSE.md).

---

<div align="center">

**🚀 مُطوّر بـ ❤️ لمجتمع المطورين العرب**

[الموقع الرسمي](https://whatsapp-saas.com) • 
[الوثائق](https://docs.whatsapp-saas.com) • 
[المجتمع](https://discord.gg/whatsapp-saas)

</div>