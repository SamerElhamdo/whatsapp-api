const express = require('express')
const { authenticate } = require('../middleware/auth')
const logger = require('../config/logger')

const router = express.Router()

// @route   GET /api/v1/users/profile
// @desc    Get user profile (alias for /auth/me)
// @access  Private
router.get('/profile', authenticate, async (req, res, next) => {
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
          features: user.subscription.plan.features
        } : null
      }
    })

  } catch (error) {
    logger.error('Get profile error:', error)
    next(error)
  }
})

module.exports = router