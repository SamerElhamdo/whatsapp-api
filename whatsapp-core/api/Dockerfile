# Gateway API Dockerfile
FROM node:18-alpine

# تثبيت أدوات Docker CLI في الحاوية
RUN apk add --no-cache docker-cli

# إنشاء مجلد العمل
WORKDIR /app

# نسخ package files
COPY package*.json ./

# تثبيت dependencies
RUN npm ci --only=production

# نسخ كود التطبيق
COPY . .

# إنشاء مجلد logs
RUN mkdir -p /app/logs

# إنشاء مجلد للتخزين
RUN mkdir -p /app/storage

# تعيين المتغيرات
ENV NODE_ENV=production
ENV PORT=3000

# فتح البورت
EXPOSE 3000

# تشغيل التطبيق
CMD ["node", "server.js"]