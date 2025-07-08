const express = require('express')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const { User, Subscription, SubscriptionPlan } = require('../models')
const { authenticate } = require('../middleware/auth')
const logger = require('../config/logger')

const router = express.Router()

// Validation middleware
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('name')
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required')
]

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
]

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

// @route   POST /api/v1/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', validateRegister, async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const { email, password, name, phone } = req.body

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } })
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists with this email'
      })
    }

    // Get free plan
    const freePlan = await SubscriptionPlan.findOne({ 
      where: { name: 'Free', is_active: true } 
    })

    if (!freePlan) {
      return res.status(500).json({
        success: false,
        error: 'No subscription plans available'
      })
    }

    // Create user
    const user = await User.create({
      email,
      password_hash: password, // Will be hashed by the model hook
      name,
      phone,
      email_verified: !process.env.ENABLE_EMAIL_VERIFICATION || false
    })

    // Create subscription
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 1 year for free plan

    const subscription = await Subscription.create({
      user_id: user.id,
      plan_id: freePlan.id,
      status: 'active',
      expires_at: expiresAt
    })

    // Update user with subscription
    await user.update({ subscription_id: subscription.id })

    // Generate token
    const token = generateToken(user.id)

    logger.info(`New user registered: ${email}`)

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          email_verified: user.email_verified,
          created_at: user.created_at
        },
        subscription: {
          plan: freePlan.name,
          status: subscription.status,
          expires_at: subscription.expires_at
        },
        token
      }
    })

  } catch (error) {
    logger.error('Registration error:', error)
    next(error)
  }
})

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const { email, password } = req.body

    // Find user with subscription details
    const user = await User.findOne({
      where: { email },
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
        error: 'Invalid email or password'
      })
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      })
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      })
    }

    // Update last login
    await user.update({ last_login: new Date() })

    // Generate token
    const token = generateToken(user.id)

    logger.info(`User logged in: ${email}`)

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          email_verified: user.email_verified,
          last_login: user.last_login
        },
        subscription: user.subscription ? {
          plan: user.subscription.plan.name,
          status: user.subscription.status,
          expires_at: user.subscription.expires_at,
          features: user.subscription.plan.features
        } : null,
        token
      }
    })

  } catch (error) {
    logger.error('Login error:', error)
    next(error)
  }
})

// @route   GET /api/v1/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = req.user

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          email_verified: user.email_verified,
          last_login: user.last_login,
          created_at: user.created_at
        },
        subscription: user.subscription ? {
          plan: user.subscription.plan.name,
          status: user.subscription.status,
          expires_at: user.subscription.expires_at,
          features: user.subscription.plan.features,
          limits: {
            max_sessions: user.subscription.plan.max_sessions,
            max_messages_per_month: user.subscription.plan.max_messages_per_month,
            max_concurrent_instances: user.subscription.plan.max_concurrent_instances
          }
        } : null
      }
    })

  } catch (error) {
    logger.error('Get profile error:', error)
    next(error)
  }
})

// @route   POST /api/v1/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh', authenticate, async (req, res, next) => {
  try {
    const user = req.user

    // Generate new token
    const token = generateToken(user.id)

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token
      }
    })

  } catch (error) {
    logger.error('Token refresh error:', error)
    next(error)
  }
})

// @route   POST /api/v1/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // In a JWT-based system, logout is typically handled client-side
    // by removing the token. We can log the event for analytics.
    
    logger.info(`User logged out: ${req.user.email}`)

    res.json({
      success: true,
      message: 'Logout successful'
    })

  } catch (error) {
    logger.error('Logout error:', error)
    next(error)
  }
})

module.exports = router