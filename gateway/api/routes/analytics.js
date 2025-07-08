const express = require('express')
const { MessageLog, UsageStats } = require('../models')
const { authenticate } = require('../middleware/auth')
const logger = require('../config/logger')

const router = express.Router()

// @route   GET /api/v1/analytics/overview
// @desc    Get analytics overview
// @access  Private
router.get('/overview', authenticate, async (req, res, next) => {
  try {
    // Get message counts
    const totalMessages = await MessageLog.count({
      where: { user_id: req.user.id }
    })

    const todayMessages = await MessageLog.count({
      where: { 
        user_id: req.user.id,
        created_at: {
          [require('sequelize').Op.gte]: new Date().setHours(0, 0, 0, 0)
        }
      }
    })

    // Get sessions and instances count
    const totalSessions = await req.user.countSessions()
    const totalInstances = await req.user.countInstances()

    res.json({
      success: true,
      data: {
        overview: {
          total_messages: totalMessages,
          messages_today: todayMessages,
          total_sessions: totalSessions,
          total_instances: totalInstances
        }
      }
    })

  } catch (error) {
    logger.error('Get analytics error:', error)
    next(error)
  }
})

module.exports = router