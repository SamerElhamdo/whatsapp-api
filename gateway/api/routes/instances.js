const express = require('express')
const { Instance, Session } = require('../models')
const { authenticate, checkSubscriptionLimits } = require('../middleware/auth')
const logger = require('../config/logger')

const router = express.Router()

// @route   GET /api/v1/instances
// @desc    Get user's instances
// @access  Private
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query
    
    const whereClause = { user_id: req.user.id }
    if (status) {
      whereClause.status = status
    }

    const instances = await Instance.findAll({
      where: whereClause,
      include: [{
        model: Session,
        as: 'session',
        attributes: ['id', 'session_name', 'status', 'phone_number']
      }],
      order: [['created_at', 'DESC']]
    })

    res.json({
      success: true,
      data: { instances }
    })

  } catch (error) {
    logger.error('Get instances error:', error)
    next(error)
  }
})

// @route   POST /api/v1/instances
// @desc    Start new instance for session
// @access  Private
router.post('/', 
  authenticate, 
  checkSubscriptionLimits('instances'),
  async (req, res, next) => {
    try {
      const { session_id } = req.body

      if (!session_id) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required'
        })
      }

      // Check if session exists and belongs to user
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

      // Check if instance already exists for this session
      const existingInstance = await Instance.findOne({
        where: { 
          user_id: req.user.id,
          session_id: session_id
        }
      })

      if (existingInstance && existingInstance.status !== 'stopped') {
        return res.status(409).json({
          success: false,
          error: 'Instance already exists for this session',
          data: { instance: existingInstance }
        })
      }

      // Generate available port (simplified - in production use proper port management)
      const portStart = parseInt(process.env.INSTANCE_PORT_RANGE_START) || 4000
      const portEnd = parseInt(process.env.INSTANCE_PORT_RANGE_END) || 4999
      const usedPorts = await Instance.findAll({
        where: { status: ['starting', 'running'] },
        attributes: ['port']
      })
      
      let availablePort = portStart
      const usedPortNumbers = usedPorts.map(i => i.port)
      
      while (usedPortNumbers.includes(availablePort) && availablePort <= portEnd) {
        availablePort++
      }

      if (availablePort > portEnd) {
        return res.status(503).json({
          success: false,
          error: 'No available ports for new instance'
        })
      }

      // Create or update instance
      const instanceData = {
        user_id: req.user.id,
        session_id: session_id,
        container_name: `whatsapp_${req.user.id}_${session.session_name}`,
        port: availablePort,
        status: 'starting'
      }

      let instance
      if (existingInstance) {
        instance = await existingInstance.update(instanceData)
      } else {
        instance = await Instance.create(instanceData)
      }

      // TODO: Implement Docker container creation here
      logger.info(`Instance starting: ${instance.container_name} on port ${instance.port}`)

      res.status(201).json({
        success: true,
        message: 'Instance is starting',
        data: { instance }
      })

    } catch (error) {
      logger.error('Start instance error:', error)
      next(error)
    }
  }
)

// @route   GET /api/v1/instances/:instanceId
// @desc    Get instance details
// @access  Private
router.get('/:instanceId', authenticate, async (req, res, next) => {
  try {
    const instance = await Instance.findOne({
      where: { 
        id: req.params.instanceId,
        user_id: req.user.id 
      },
      include: [{
        model: Session,
        as: 'session',
        attributes: ['id', 'session_name', 'status']
      }]
    })

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      })
    }

    res.json({
      success: true,
      data: { instance }
    })

  } catch (error) {
    logger.error('Get instance error:', error)
    next(error)
  }
})

// @route   POST /api/v1/instances/:instanceId/stop
// @desc    Stop instance
// @access  Private
router.post('/:instanceId/stop', authenticate, async (req, res, next) => {
  try {
    const instance = await Instance.findOne({
      where: { 
        id: req.params.instanceId,
        user_id: req.user.id 
      }
    })

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      })
    }

    if (instance.status === 'stopped') {
      return res.status(400).json({
        success: false,
        error: 'Instance is already stopped'
      })
    }

    // Update instance status
    await instance.updateStatus('stopping')

    // TODO: Implement Docker container stop here
    logger.info(`Instance stopping: ${instance.container_name}`)

    // Simulate stopping process
    setTimeout(async () => {
      await instance.updateStatus('stopped')
    }, 2000)

    res.json({
      success: true,
      message: 'Instance is stopping',
      data: { instance }
    })

  } catch (error) {
    logger.error('Stop instance error:', error)
    next(error)
  }
})

// @route   POST /api/v1/instances/:instanceId/restart
// @desc    Restart instance
// @access  Private
router.post('/:instanceId/restart', authenticate, async (req, res, next) => {
  try {
    const instance = await Instance.findOne({
      where: { 
        id: req.params.instanceId,
        user_id: req.user.id 
      }
    })

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      })
    }

    // Update instance status
    await instance.updateStatus('starting')

    // TODO: Implement Docker container restart here
    logger.info(`Instance restarting: ${instance.container_name}`)

    res.json({
      success: true,
      message: 'Instance is restarting',
      data: { instance }
    })

  } catch (error) {
    logger.error('Restart instance error:', error)
    next(error)
  }
})

module.exports = router