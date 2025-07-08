/**
 * WhatsApp Instance Wrapper
 * يربط المشروع الأصلي مع Gateway System
 */

const express = require('express')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

// استيراد المشروع الأصلي
const originalApp = require('./src/app')

const app = express()
app.use(express.json())

// إعدادات Instance
const INSTANCE_ID = process.env.INSTANCE_ID
const INSTANCE_PORT = process.env.INSTANCE_PORT || 3000
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway_api:3000'
const SESSION_PATH = process.env.SESSION_PATH || './storage/sessions'
const USER_ID = process.env.USER_ID
const SESSION_ID = process.env.SESSION_ID

console.log(`🚀 WhatsApp Instance Wrapper Starting...`)
console.log(`📍 Instance ID: ${INSTANCE_ID}`)
console.log(`🔌 Port: ${INSTANCE_PORT}`)
console.log(`🗄️  Session Path: ${SESSION_PATH}`)

// تأكد من وجود مجلد الجلسات
if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true })
}

// حالة Instance
let instanceStatus = {
  status: 'starting',
  qr_code: null,
  phone_number: null,
  last_seen: new Date(),
  connected: false
}

/**
 * تحديث حالة Instance في Gateway
 */
async function updateGatewayStatus(status, additionalData = {}) {
  try {
    await axios.post(`${GATEWAY_URL}/internal/instances/${INSTANCE_ID}/status`, {
      status,
      ...additionalData,
      last_health_check: new Date(),
      timestamp: new Date()
    })
    console.log(`✅ تم تحديث حالة Gateway: ${status}`)
  } catch (error) {
    console.error(`❌ فشل تحديث حالة Gateway:`, error.message)
  }
}

/**
 * إرسال webhook إلى Gateway
 */
async function sendWebhook(event, data) {
  try {
    await axios.post(`${GATEWAY_URL}/internal/webhooks`, {
      instance_id: INSTANCE_ID,
      user_id: USER_ID,
      session_id: SESSION_ID,
      event,
      data,
      timestamp: new Date()
    })
  } catch (error) {
    console.error(`❌ فشل إرسال webhook:`, error.message)
  }
}

// ====================
// ربط المشروع الأصلي
// ====================

// استخدام routes المشروع الأصلي
app.use('/api', originalApp)

// ====================
// Instance-specific Routes
// ====================

/**
 * صحة Instance
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    instance_id: INSTANCE_ID,
    instance_status: instanceStatus,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  })
})

/**
 * حالة Instance
 */
app.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      instance_id: INSTANCE_ID,
      ...instanceStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  })
})

/**
 * تحديث إعدادات Session
 */
app.post('/session/settings', (req, res) => {
  const { settings } = req.body
  
  // تطبيق الإعدادات على الجلسة
  console.log('📝 تحديث إعدادات الجلسة:', settings)
  
  res.json({
    success: true,
    message: 'تم تحديث إعدادات الجلسة',
    settings
  })
})

/**
 * إيقاف Instance
 */
app.post('/shutdown', async (req, res) => {
  console.log('🛑 تم طلب إيقاف Instance...')
  
  instanceStatus.status = 'stopping'
  await updateGatewayStatus('stopping')
  
  res.json({
    success: true,
    message: 'Instance يتم إيقافه...'
  })
  
  // إيقاف بعد ثانيتين
  setTimeout(() => {
    process.exit(0)
  }, 2000)
})

// ====================
// WhatsApp Events Integration
// ====================

// هنا سيتم ربط events من whatsapp-web.js
// مع webhook system في Gateway

// مثال: عندما يتم إنشاء QR code
const simulateWhatsAppEvents = () => {
  // QR Code Generated
  setTimeout(() => {
    const qrCode = `data:image/png;base64,fake_qr_code_${Date.now()}`
    instanceStatus.qr_code = qrCode
    instanceStatus.status = 'qr_ready'
    
    console.log('📱 تم إنشاء QR Code')
    updateGatewayStatus('qr_ready', { qr_code: qrCode })
    sendWebhook('qr', { qr_code: qrCode })
  }, 3000)
  
  // Authentication successful (simulation)
  setTimeout(() => {
    const phoneNumber = '+1234567890'
    instanceStatus.phone_number = phoneNumber
    instanceStatus.status = 'authenticated'
    instanceStatus.connected = true
    instanceStatus.qr_code = null
    
    console.log('✅ تم التوثيق بنجاح')
    updateGatewayStatus('authenticated', { phone_number: phoneNumber })
    sendWebhook('authenticated', { phone_number: phoneNumber })
  }, 10000)
  
  // Running status
  setTimeout(() => {
    instanceStatus.status = 'running'
    updateGatewayStatus('running')
    sendWebhook('ready', { message: 'Instance جاهز للاستخدام' })
  }, 12000)
}

// ====================
// Heartbeat & Monitoring
// ====================

/**
 * إرسال heartbeat دوري للـ Gateway
 */
setInterval(async () => {
  instanceStatus.last_seen = new Date()
  await updateGatewayStatus(instanceStatus.status, {
    cpu_usage: process.cpuUsage(),
    memory_usage: process.memoryUsage().rss / 1024 / 1024, // MB
    uptime: process.uptime()
  })
}, 30000) // كل 30 ثانية

// ====================
// تشغيل الخادم
// ====================

const server = app.listen(INSTANCE_PORT, '0.0.0.0', async () => {
  console.log(`🚀 WhatsApp Instance يعمل على البورت ${INSTANCE_PORT}`)
  
  // تحديث حالة البداية
  await updateGatewayStatus('starting')
  
  // محاكاة أحداث WhatsApp (في الإنتاج سيتم ربطها مع whatsapp-web.js)
  simulateWhatsAppEvents()
})

// معالجة إيقاف graceful
process.on('SIGTERM', async () => {
  console.log('📴 تلقي إشارة إيقاف...')
  await updateGatewayStatus('stopped')
  server.close(() => {
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  console.log('📴 تلقي إشارة إيقاف...')
  await updateGatewayStatus('stopped')
  server.close(() => {
    process.exit(0)
  })
})

console.log('🔗 تم ربط WhatsApp Instance مع Gateway System')
console.log('🔄 في انتظار أحداث WhatsApp...')