# WhatsApp Instance Container
# يستخدم المشروع الأصلي من البرانش الرئيسي

FROM node:18-alpine

# تثبيت المتطلبات
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# إنشاء مجلد العمل
WORKDIR /app

# نسخ المشروع الأصلي (من الجذر)
COPY ../package*.json ./
COPY ../src ./src
COPY ../server.js ./
COPY ../swagger.js ./

# نسخ إعدادات instance الخاصة
COPY ./instance-wrapper.js ./
COPY ./package*.json ./instance-

# تثبيت dependencies للمشروع الأصلي
RUN npm install

# تثبيت dependencies إضافية للـ instance wrapper
RUN npm install --prefix ./instance- axios dotenv

# إعداد متغيرات Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# إنشاء مجلدات التخزين
RUN mkdir -p /app/storage/sessions /app/storage/media

# المنافذ
EXPOSE 3000

# تشغيل wrapper بدلاً من server الأصلي مباشرة
CMD ["node", "instance-wrapper.js"]