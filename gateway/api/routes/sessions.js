const express = require('express')
const { body, validationResult } = require('express-validator')
const { Session } = require('../models')
const { authenticate, checkSubscriptionLimits } = require('../middleware/auth')
const logger = require('../config/logger')

const router = express.Router()

// Validation middleware
const validateCreateSession = [
  body('session_name')
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Session name must be 2-100 characters and contain only letters, numbers, underscore, and dash'),
  body('webhook_url')
    .optional()
    .isURL()
    .withMessage('Webhook URL must be a valid URL'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object')
]

// @route   GET /api/v1/sessions
// @desc    Get user's sessions
// @access  Private
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query
    
    const whereClause = { user_id: req.user.id }
    if (status) {
      whereClause.status = status
    }

    const sessions = await Session.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']]
    })

    res.json({
      success: true,
      data: {
        sessions: sessions.rows,
        pagination: {
          total: sessions.count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(sessions.count / parseInt(limit))
        }
      }
    })

  } catch (error) {
    logger.error('Get sessions error:', error)
    next(error)
  }
})

// @route   POST /api/v1/sessions
// @desc    Create new session
// @access  Private
router.post('/', 
  authenticate, 
  checkSubscriptionLimits('sessions'),
  validateCreateSession, 
  async (req, res, next) => {
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

      const { session_name, webhook_url, settings = {} } = req.body

      // Check if session name already exists for this user
      const existingSession = await Session.findOne({
        where: { 
          user_id: req.user.id, 
          session_name 
        }
      })

      if (existingSession) {
        return res.status(409).json({
          success: false,
          error: 'Session with this name already exists'
        })
      }

      // Create session
      const session = await Session.create({
        user_id: req.user.id,
        session_name,
        webhook_url,
        settings,
        status: 'pending'
      })

      logger.info(`Session created: ${session_name} for user ${req.user.email}`)

      res.status(201).json({
        success: true,
        message: 'Session created successfully',
        data: { session }
      })

    } catch (error) {
      logger.error('Create session error:', error)
      next(error)
    }
  }
)

// @route   GET /api/v1/sessions/:sessionId
// @desc    Get session details
// @access  Private
router.get('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const session = await Session.findOne({
      where: { 
        id: req.params.sessionId,
        user_id: req.user.id 
      }
    })

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      })
    }

    res.json({
      success: true,
      data: { session }
    })

  } catch (error) {
    logger.error('Get session error:', error)
    next(error)
  }
})

// @route   PUT /api/v1/sessions/:sessionId
// @desc    Update session
// @access  Private
router.put('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { webhook_url, settings } = req.body

    const session = await Session.findOne({
      where: { 
        id: req.params.sessionId,
        user_id: req.user.id 
      }
    })

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      })
    }

    // Update session
    const updateData = {}
    if (webhook_url !== undefined) updateData.webhook_url = webhook_url
    if (settings !== undefined) updateData.settings = settings

    await session.update(updateData)

    logger.info(`Session updated: ${session.session_name} for user ${req.user.email}`)

    res.json({
      success: true,
      message: 'Session updated successfully',
      data: { session }
    })

  } catch (error) {
    logger.error('Update session error:', error)
    next(error)
  }
})

// @route   DELETE /api/v1/sessions/:sessionId
// @desc    Delete session
// @access  Private
router.delete('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const session = await Session.findOne({
      where: { 
        id: req.params.sessionId,
        user_id: req.user.id 
      }
    })

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      })
    }

    // Check if session has running instances
    const runningInstances = await session.countInstances({
      where: { status: ['starting', 'running'] }
    })

    if (runningInstances > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete session with running instances. Please stop all instances first.'
      })
    }

    await session.destroy()

    logger.info(`Session deleted: ${session.session_name} for user ${req.user.email}`)

    res.json({
      success: true,
      message: 'Session deleted successfully'
    })

  } catch (error) {
    logger.error('Delete session error:', error)
    next(error)
  }
})

module.exports = router