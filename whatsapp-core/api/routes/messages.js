const express = require('express')
const { body, validationResult } = require('express-validator')
const { Instance, Session, MessageLog } = require('../models')
const { authenticate, checkSubscriptionLimits, checkApiKeyPermissions } = require('../middleware/auth')
const logger = require('../config/logger')

const router = express.Router()

// Validation middleware
const validateSendMessage = [
  body('recipient')
    .notEmpty()
    .withMessage('Recipient is required'),
  body('message')
    .notEmpty()
    .withMessage('Message is required'),
  body('session_id')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('message_type')
    .optional()
    .isIn(['text', 'image', 'video', 'audio', 'document', 'location'])
    .withMessage('Invalid message type')
]

// @route   POST /api/v1/messages/send
// @desc    Send message through WhatsApp instance
// @access  Private
router.post('/send', 
  authenticate,
  checkSubscriptionLimits('messages'),
  checkApiKeyPermissions('send_message'),
  validateSendMessage,
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

      const { recipient, message, session_id, message_type = 'text' } = req.body

      // Find user's session
      const session = await Session.findOne({
        where: { 
          id: session_id,
          user_id: req.user.id 
        }
      })

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        })
      }

      // Find running instance for this session
      const instance = await Instance.findOne({
        where: { 
          user_id: req.user.id,
          session_id: session_id,
          status: 'running'
        }
      })

      if (!instance) {
        return res.status(400).json({
          success: false,
          error: 'No running instance found for this session. Please start an instance first.'
        })
      }

      // Check if instance is healthy
      if (!instance.isHealthy()) {
        return res.status(503).json({
          success: false,
          error: 'Instance is not healthy. Please check instance status.'
        })
      }

      // TODO: Implement actual message sending to WhatsApp instance
      // For now, we'll simulate it
      const messageLogData = {
        user_id: req.user.id,
        session_id: session_id,
        instance_id: instance.id,
        message_type,
        recipient,
        status: 'sent', // In real implementation, this would be updated based on actual response
        metadata: {
          message_content: message,
          sent_at: new Date(),
          instance_port: instance.port
        }
      }

      // Log the message
      const messageLog = await MessageLog.create(messageLogData)

      logger.info(`Message sent: ${recipient} via instance ${instance.container_name}`)

      res.json({
        success: true,
        message: 'Message sent successfully',
        data: {
          message_id: messageLog.id,
          recipient,
          status: 'sent',
          instance: {
            id: instance.id,
            container_name: instance.container_name,
            port: instance.port
          },
          sent_at: messageLog.created_at
        }
      })

    } catch (error) {
      logger.error('Send message error:', error)
      next(error)
    }
  }
)

// @route   GET /api/v1/messages
// @desc    Get message history
// @access  Private
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, session_id, status } = req.query
    
    const whereClause = { user_id: req.user.id }
    if (session_id) whereClause.session_id = session_id
    if (status) whereClause.status = status

    const messages = await MessageLog.findAndCountAll({
      where: whereClause,
      include: [{
        model: Session,
        as: 'session',
        attributes: ['id', 'session_name']
      }],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']]
    })

    res.json({
      success: true,
      data: {
        messages: messages.rows,
        pagination: {
          total: messages.count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(messages.count / parseInt(limit))
        }
      }
    })

  } catch (error) {
    logger.error('Get messages error:', error)
    next(error)
  }
})

// @route   GET /api/v1/messages/:messageId
// @desc    Get message details
// @access  Private
router.get('/:messageId', authenticate, async (req, res, next) => {
  try {
    const message = await MessageLog.findOne({
      where: { 
        id: req.params.messageId,
        user_id: req.user.id 
      },
      include: [
        {
          model: Session,
          as: 'session',
          attributes: ['id', 'session_name']
        },
        {
          model: Instance,
          as: 'instance',
          attributes: ['id', 'container_name', 'port']
        }
      ]
    })

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      })
    }

    res.json({
      success: true,
      data: { message }
    })

  } catch (error) {
    logger.error('Get message error:', error)
    next(error)
  }
})

module.exports = router