const express = require('express')
const axios = require('axios')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// تهيئة قائمة الـ instances
const instances = process.env.INSTANCES ? process.env.INSTANCES.split(',') : []
let currentInstanceIndex = 0

// متغيرات الإعداد
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 10000

// تتبع حالة الـ instances
const instanceHealth = {}

// تهيئة حالة الـ instances
instances.forEach(instance => {
  instanceHealth[instance] = {
    healthy: true,
    lastChecked: new Date(),
    responseTime: null
  }
})

/**
 * اختيار instance بالتناوب (Round Robin)
 * @returns {string|null} عنوان instance أو null إذا لم يوجد متاح
 */
function getNextInstance() {
  if (instances.length === 0) return null
  
  // البحث عن instance صحي
  const healthyInstances = instances.filter(instance => instanceHealth[instance].healthy)
  
  if (healthyInstances.length === 0) {
    console.warn('⚠️ لا توجد instances متاحة!')
    return null
  }
  
  // التنقل بين instances المتاحة
  const instance = healthyInstances[currentInstanceIndex % healthyInstances.length]
  currentInstanceIndex = (currentInstanceIndex + 1) % healthyInstances.length
  
  return instance
}

/**
 * فحص حالة instance معين
 * @param {string} instance 
 */
async function checkInstanceHealth(instance) {
  try {
    const startTime = Date.now()
    const response = await axios.get(`${instance}/health`, { 
      timeout: REQUEST_TIMEOUT 
    })
    const responseTime = Date.now() - startTime
    
    instanceHealth[instance] = {
      healthy: response.status === 200,
      lastChecked: new Date(),
      responseTime: responseTime
    }
    
    if (response.status === 200) {
      console.log(`✅ ${instance} - صحي (${responseTime}ms)`)
    }
  } catch (error) {
    instanceHealth[instance] = {
      healthy: false,
      lastChecked: new Date(),
      responseTime: null
    }
    console.log(`❌ ${instance} - غير متاح: ${error.message}`)
  }
}

/**
 * فحص حالة جميع instances
 */
async function performHealthCheck() {
  console.log('🔍 بدء فحص صحة instances...')
  const healthChecks = instances.map(instance => checkInstanceHealth(instance))
  await Promise.all(healthChecks)
}

// ====================
// API Routes
// ====================

/**
 * GET /status - عرض حالة Gateway وجميع instances
 */
app.get('/status', (req, res) => {
  const healthyInstances = instances.filter(instance => instanceHealth[instance].healthy)
  
  res.json({
    gateway: {
      status: 'running',
      port: PORT,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    instances: {
      total: instances.length,
      healthy: healthyInstances.length,
      unhealthy: instances.length - healthyInstances.length,
      details: instanceHealth
    },
    loadBalancer: {
      algorithm: 'round-robin',
      currentIndex: currentInstanceIndex
    }
  })
})

/**
 * POST /send-message - إرسال رسالة عبر أحد instances
 */
app.post('/send-message', async (req, res) => {
  try {
    const instance = getNextInstance()
    
    if (!instance) {
      return res.status(503).json({
        success: false,
        error: 'لا توجد instances متاحة',
        details: 'جميع instances غير متاحة حالياً'
      })
    }
    
    console.log(`📤 إرسال رسالة عبر: ${instance}`)
    
    // إرسال الطلب إلى instance المختار
    const response = await axios.post(
      `${instance}/send-message`,
      req.body,
      {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          // نقل headers إضافية إذا كانت موجودة
          ...req.headers
        }
      }
    )
    
    // إرسال استجابة instance للعميل
    res.status(response.status).json({
      success: true,
      data: response.data,
      instance: instance,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ خطأ في إرسال الرسالة:', error.message)
    
    // إذا كان الخطأ من instance معين، نعلمه كغير متاح
    if (error.config && error.config.url) {
      const failedInstance = error.config.url.replace('/send-message', '')
      if (instanceHealth[failedInstance]) {
        instanceHealth[failedInstance].healthy = false
        instanceHealth[failedInstance].lastChecked = new Date()
      }
    }
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'فشل في إرسال الرسالة',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * GET /health - فحص صحة Gateway
 */
app.get('/health', (req, res) => {
  const healthyInstances = instances.filter(instance => instanceHealth[instance].healthy)
  
  res.json({
    status: 'healthy',
    instances: {
      total: instances.length,
      healthy: healthyInstances.length
    },
    timestamp: new Date().toISOString()
  })
})

/**
 * POST /* - توجيه جميع الطلبات الأخرى للـ instances
 */
app.all('*', async (req, res) => {
  try {
    const instance = getNextInstance()
    
    if (!instance) {
      return res.status(503).json({
        success: false,
        error: 'لا توجد instances متاحة'
      })
    }
    
    console.log(`🔄 توجيه ${req.method} ${req.path} إلى: ${instance}`)
    
    const response = await axios({
      method: req.method,
      url: `${instance}${req.path}`,
      data: req.body,
      params: req.query,
      headers: {
        ...req.headers,
        host: undefined // إزالة host header لتجنب تضارب
      },
      timeout: REQUEST_TIMEOUT
    })
    
    res.status(response.status).json(response.data)
    
  } catch (error) {
    console.error(`❌ خطأ في توجيه الطلب:`, error.message)
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'فشل في توجيه الطلب',
      details: error.message
    })
  }
})

// ====================
// تشغيل الخادم
// ====================

// فحص أولي للـ instances
performHealthCheck()

// جدولة فحص دوري للـ instances
setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL)

app.listen(PORT, () => {
  console.log(`
🚀 WhatsApp API Gateway يعمل على البورت ${PORT}
📋 عدد instances: ${instances.length}
🔄 فحص الصحة كل: ${HEALTH_CHECK_INTERVAL/1000} ثانية
⏱️  مهلة الطلبات: ${REQUEST_TIMEOUT/1000} ثانية

📍 Endpoints متاحة:
   GET  /status      - حالة Gateway
   GET  /health      - فحص الصحة
   POST /send-message - إرسال رسالة
   
🌐 Instances:
${instances.map(instance => `   - ${instance}`).join('\n')}
`)
})