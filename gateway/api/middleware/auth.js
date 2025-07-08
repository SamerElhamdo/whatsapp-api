const jwt = require('jsonwebtoken')
const { User, Subscription, SubscriptionPlan } = require('../models')
const logger = require('../config/logger')

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // Get user with subscription details
    const user = await User.findByPk(decoded.userId, {
      include: [{
        model: Subscription,
        as: 'subscription',
        include: [{
          model: SubscriptionPlan,
          as: 'plan'
        }]
      }]
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token - user not found'
      })
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account deactivated'
      })
    }

    // Check if subscription is active
    if (!user.subscription || user.subscription.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Subscription not active'
      })
    }

    // Check if subscription is expired
    if (user.subscription.expires_at && new Date() > user.subscription.expires_at) {
      return res.status(403).json({
        success: false,
        error: 'Subscription expired'
      })
    }

    req.user = user
    next()

  } catch (error) {
    logger.error('Authentication error:', error)
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      })
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    })
  }
}

// Check subscription limits
const checkSubscriptionLimits = (limitType) => {
  return async (req, res, next) => {
    try {
      const user = req.user
      const plan = user.subscription.plan

      switch (limitType) {
        case 'sessions':
          const sessionCount = await user.countSessions()
          if (sessionCount >= plan.max_sessions) {
            return res.status(403).json({
              success: false,
              error: `Session limit reached. Maximum ${plan.max_sessions} sessions allowed.`,
              limit: plan.max_sessions,
              current: sessionCount
            })
          }
          break

        case 'instances':
          const instanceCount = await user.countInstances()
          if (instanceCount >= plan.max_concurrent_instances) {
            return res.status(403).json({
              success: false,
              error: `Instance limit reached. Maximum ${plan.max_concurrent_instances} concurrent instances allowed.`,
              limit: plan.max_concurrent_instances,
              current: instanceCount
            })
          }
          break

        case 'messages':
          // Check monthly message limit
          const startOfMonth = new Date()
          startOfMonth.setDate(1)
          startOfMonth.setHours(0, 0, 0, 0)

          const messageCount = await user.countMessageLogs({
            where: {
              created_at: {
                [require('sequelize').Op.gte]: startOfMonth
              }
            }
          })

          if (messageCount >= plan.max_messages_per_month) {
            return res.status(403).json({
              success: false,
              error: `Monthly message limit reached. Maximum ${plan.max_messages_per_month} messages allowed.`,
              limit: plan.max_messages_per_month,
              current: messageCount
            })
          }
          break

        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid limit type'
          })
      }

      next()

    } catch (error) {
      logger.error('Subscription limit check error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to check subscription limits'
      })
    }
  }
}

// API Key authentication (alternative to JWT)
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key']

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      })
    }

    const { ApiKey } = require('../models')
    const keyRecord = await ApiKey.findOne({
      where: { 
        api_key: apiKey,
        is_active: true
      },
      include: [{
        model: User,
        as: 'user',
        include: [{
          model: Subscription,
          as: 'subscription',
          include: [{
            model: SubscriptionPlan,
            as: 'plan'
          }]
        }]
      }]
    })

    if (!keyRecord) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      })
    }

    // Check if key is expired
    if (keyRecord.expires_at && new Date() > keyRecord.expires_at) {
      return res.status(401).json({
        success: false,
        error: 'API key expired'
      })
    }

    // Update last used timestamp
    await keyRecord.update({ last_used: new Date() })

    req.user = keyRecord.user
    req.apiKey = keyRecord
    next()

  } catch (error) {
    logger.error('API key authentication error:', error)
    return res.status(500).json({
      success: false,
      error: 'API key authentication failed'
    })
  }
}

// Check API key permissions
const checkApiKeyPermissions = (requiredPermission) => {
  return (req, res, next) => {
    try {
      if (!req.apiKey) {
        return next() // JWT authentication, skip permission check
      }

      const permissions = req.apiKey.permissions || {}
      
      if (!permissions[requiredPermission]) {
        return res.status(403).json({
          success: false,
          error: `API key does not have permission: ${requiredPermission}`
        })
      }

      next()

    } catch (error) {
      logger.error('API key permission check error:', error)
      return res.status(500).json({
        success: false,
        error: 'Permission check failed'
      })
    }
  }
}

// Combined authentication (JWT or API Key)
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization
  const apiKey = req.headers['x-api-key']

  if (apiKey) {
    return authenticateApiKey(req, res, next)
  } else if (authHeader) {
    return authenticateToken(req, res, next)
  } else {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Provide either Authorization header or X-API-Key header.'
    })
  }
}

module.exports = {
  authenticateToken,
  authenticateApiKey,
  authenticate,
  checkSubscriptionLimits,
  checkApiKeyPermissions
}