const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const { sequelize } = require('./config/database')
const logger = require('./config/logger')
const { errorHandler, notFound } = require('./middleware/errorHandler')

// Import routes
const authRoutes = require('./routes/auth')
const sessionRoutes = require('./routes/sessions')
const instanceRoutes = require('./routes/instances')
const messageRoutes = require('./routes/messages')
const userRoutes = require('./routes/users')
const webhookRoutes = require('./routes/webhooks')
const analyticsRoutes = require('./routes/analytics')

const app = express()
const PORT = process.env.PORT || 3000

// Trust proxy for correct IP addresses
app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}))

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true)
    
    // Add your allowed origins here
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://yourdomain.com'
    ]
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// Body parsing middleware
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  })
  next()
})

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await sequelize.authenticate()
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'connected',
        redis: 'connected' // TODO: Add redis health check
      },
      uptime: process.uptime()
    })
  } catch (error) {
    logger.error('Health check failed:', error)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// API routes
const apiVersion = process.env.API_VERSION || 'v1'
app.use(`/api/${apiVersion}/auth`, authRoutes)
app.use(`/api/${apiVersion}/sessions`, sessionRoutes)
app.use(`/api/${apiVersion}/instances`, instanceRoutes)
app.use(`/api/${apiVersion}/messages`, messageRoutes)
app.use(`/api/${apiVersion}/users`, userRoutes)
app.use(`/api/${apiVersion}/webhooks`, webhookRoutes)
app.use(`/api/${apiVersion}/analytics`, analyticsRoutes)

// API documentation
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp SaaS Gateway API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'Gateway API for Multi-User WhatsApp Management System',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: `GET,POST /api/${apiVersion}/auth/*`,
      sessions: `GET,POST,PUT,DELETE /api/${apiVersion}/sessions/*`,
      instances: `GET,POST,PUT,DELETE /api/${apiVersion}/instances/*`,
      messages: `POST /api/${apiVersion}/messages/*`,
      users: `GET,PUT /api/${apiVersion}/users/*`,
      webhooks: `GET,POST,PUT,DELETE /api/${apiVersion}/webhooks/*`,
      analytics: `GET /api/${apiVersion}/analytics/*`,
      health: 'GET /health'
    },
    documentation: `https://docs.yourdomain.com/api/${apiVersion}`,
    support: 'support@yourdomain.com'
  })
})

// Error handling middleware
app.use(notFound)
app.use(errorHandler)

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server gracefully...')
  
  // Close database connections
  try {
    await sequelize.close()
    logger.info('Database connections closed')
  } catch (error) {
    logger.error('Error closing database connections:', error)
  }
  
  process.exit(0)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate()
    logger.info('Database connection established successfully')
    
    // Sync database models (in development only)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true })
      logger.info('Database models synchronized')
    }
    
    // Start listening
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 WhatsApp SaaS Gateway API started successfully!`)
      logger.info(`🌐 Server running on port ${PORT}`)
      logger.info(`📖 API Documentation: http://localhost:${PORT}/`)
      logger.info(`💚 Health Check: http://localhost:${PORT}/health`)
      logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error
      }
      
      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${PORT} requires elevated privileges`)
          process.exit(1)
          break
        case 'EADDRINUSE':
          logger.error(`Port ${PORT} is already in use`)
          process.exit(1)
          break
        default:
          throw error
      }
    })
    
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

module.exports = app