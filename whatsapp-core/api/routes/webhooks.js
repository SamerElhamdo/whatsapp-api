const express = require('express')
const { Webhook } = require('../models')
const { authenticate } = require('../middleware/auth')
const logger = require('../config/logger')

const router = express.Router()

// @route   GET /api/v1/webhooks
// @desc    Get user's webhooks
// @access  Private
router.get('/', authenticate, async (req, res, next) => {
  try {
    const webhooks = await Webhook.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']]
    })

    res.json({
      success: true,
      data: { webhooks }
    })

  } catch (error) {
    logger.error('Get webhooks error:', error)
    next(error)
  }
})

// @route   POST /api/v1/webhooks
// @desc    Create webhook
// @access  Private
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { url, events = ['message', 'status'], session_id } = req.body

    const webhook = await Webhook.create({
      user_id: req.user.id,
      session_id: session_id || null,
      url,
      events,
      secret: require('crypto').randomBytes(32).toString('hex')
    })

    res.status(201).json({
      success: true,
      message: 'Webhook created successfully',
      data: { webhook }
    })

  } catch (error) {
    logger.error('Create webhook error:', error)
    next(error)
  }
})

module.exports = router