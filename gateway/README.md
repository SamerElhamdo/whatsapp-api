# 🚀 WhatsApp API Gateway

نظام Gateway لتوزيع الأحمال بين عدة instances من WhatsApp API.

## 🎯 الهدف

يوفر Gateway طبقة وسطى لتوزيع الطلبات بين عدة خوادم WhatsApp API، مما يحسن من:
- **الأداء**: توزيع الأحمال بالتساوي
- **التوفر**: استمرارية الخدمة حتى لو تعطل أحد الخوادم
- **المراقبة**: تتبع حالة جميع instances

## 📦 التثبيت والتشغيل

```bash
# الانتقال لمجلد Gateway
cd gateway

# تثبيت الاعتمادات
npm install

# تشغيل Gateway
npm start

# أو للتطوير مع إعادة التشغيل التلقائي
npm run dev
```

## ⚙️ الإعداد

عدّل ملف `.env`:

```env
# بورت Gateway
PORT=3000

# قائمة instances (مفصولة بفاصلة)
INSTANCES=http://localhost:3001,http://localhost:3002,http://localhost:3003

# إعدادات إضافية
HEALTH_CHECK_INTERVAL=30000  # فحص الصحة كل 30 ثانية
REQUEST_TIMEOUT=10000        # مهلة الطلبات 10 ثواني
```

## 📍 API Endpoints

### `GET /status`
عرض حالة Gateway وجميع instances:

```json
{
  "gateway": {
    "status": "running",
    "port": 3000,
    "uptime": 1234.56
  },
  "instances": {
    "total": 3,
    "healthy": 2,
    "unhealthy": 1,
    "details": { ... }
  }
}
```

### `POST /send-message`
إرسال رسالة عبر أحد instances:

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "1234567890@c.us",
    "message": "مرحبا من Gateway!"
  }'
```

### `GET /health`
فحص سريع لصحة Gateway:

```json
{
  "status": "healthy",
  "instances": {
    "total": 3,
    "healthy": 2
  }
}
```

## 🔄 آلية التوزيع

يستخدم Gateway خوارزمية **Round Robin** لتوزيع الطلبات:

1. يختار instance التالي في القائمة
2. إذا كان غير متاح، يتخطاه للتالي
3. يرسل الطلب ويعيد النتيجة
4. يراقب استجابة instances ويحدث حالتها

## 🏥 مراقبة الصحة

- فحص دوري كل 30 ثانية افتراضياً
- تسجيل زمن الاستجابة لكل instance
- تعليم instances المتعطلة وتجنبها
- إعادة فحص instances المتعطلة تلقائياً

## 🛠️ استكشاف الأخطاء

### Instance غير متاح
```
❌ http://localhost:3001 - غير متاح: connect ECONNREFUSED
```
**الحل**: تأكد من تشغيل WhatsApp API على البورت المحدد.

### لا توجد instances متاحة
```json
{
  "success": false,
  "error": "لا توجد instances متاحة"
}
```
**الحل**: تحقق من متغير `INSTANCES` في `.env`.

## 📊 المثال العملي

```bash
# تشغيل 3 instances من WhatsApp API
npm start --port=3001 &  # Instance 1
npm start --port=3002 &  # Instance 2  
npm start --port=3003 &  # Instance 3

# تشغيل Gateway
cd gateway
npm start
```

الآن Gateway سيوزع الطلبات بين الـ 3 instances تلقائياً! 🎉