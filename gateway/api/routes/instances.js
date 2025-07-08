const express = require('express')
const { Instance, Session } = require('../models')
const { authenticate, checkSubscriptionLimits } = require('../middleware/auth')
const DockerService = require('../services/DockerService')
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

      // Generate available port
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

      // Create or update instance in database
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

      // Create Docker container using DockerService
      try {
        const containerInfo = await DockerService.createInstance({
          id: instance.id,
          user_id: req.user.id,
          session_id: session_id,
          container_name: instance.container_name,
          port: availablePort
        })

        // Update instance with container information
        await instance.update({
          container_id: containerInfo.container_id,
          status: 'starting'
        })

        logger.info(`✅ Instance started: ${instance.container_name} on port ${instance.port}`)

        res.status(201).json({
          success: true,
          message: 'Instance is starting',
          data: { 
            instance: {
              ...instance.toJSON(),
              container_id: containerInfo.container_id
            }
          }
        })

      } catch (dockerError) {
        // Rollback database changes if Docker fails
        if (!existingInstance) {
          await instance.destroy()
        } else {
          await instance.update({ status: 'error' })
        }

        logger.error('Docker creation failed:', dockerError)
        return res.status(500).json({
          success: false,
          error: 'Failed to create Docker container',
          details: dockerError.message
        })
      }

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

    // Get Docker stats if container exists
    let containerStats = null
    if (instance.container_id) {
      containerStats = await DockerService.getInstanceStats(instance.container_id)
    }

    res.json({
      success: true,
      data: { 
        instance: {
          ...instance.toJSON(),
          container_stats: containerStats
        }
      }
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

    // Stop Docker container
    if (instance.container_id) {
      try {
        await DockerService.stopInstance(instance.container_id)
        await instance.updateStatus('stopped')
        
        logger.info(`✅ Instance stopped: ${instance.container_name}`)
      } catch (dockerError) {
        await instance.updateStatus('error')
        logger.error('Failed to stop Docker container:', dockerError)
        
        return res.status(500).json({
          success: false,
          error: 'Failed to stop Docker container',
          details: dockerError.message
        })
      }
    } else {
      await instance.updateStatus('stopped')
    }

    res.json({
      success: true,
      message: 'Instance stopped successfully',
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

    // Restart Docker container
    if (instance.container_id) {
      try {
        await DockerService.restartInstance(instance.container_id)
        
        logger.info(`✅ Instance restarted: ${instance.container_name}`)
      } catch (dockerError) {
        await instance.updateStatus('error')
        logger.error('Failed to restart Docker container:', dockerError)
        
        return res.status(500).json({
          success: false,
          error: 'Failed to restart Docker container',
          details: dockerError.message
        })
      }
    }

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

// @route   DELETE /api/v1/instances/:instanceId
// @desc    Delete instance and remove container
// @access  Private
router.delete('/:instanceId', authenticate, async (req, res, next) => {
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

    // Remove Docker container if exists
    if (instance.container_id) {
      try {
        await DockerService.removeInstance(instance.container_id)
        logger.info(`🗑️ Container removed: ${instance.container_name}`)
      } catch (dockerError) {
        logger.error('Failed to remove Docker container:', dockerError)
        // Continue with database deletion even if Docker removal fails
      }
    }

    // Delete instance from database
    await instance.destroy()

    res.json({
      success: true,
      message: 'Instance deleted successfully'
    })

  } catch (error) {
    logger.error('Delete instance error:', error)
    next(error)
  }
})

// @route   GET /api/v1/instances/:instanceId/logs
// @desc    Get instance logs
// @access  Private
router.get('/:instanceId/logs', authenticate, async (req, res, next) => {
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

    if (!instance.container_id) {
      return res.status(400).json({
        success: false,
        error: 'No container associated with this instance'
      })
    }

    // Get container logs (last 100 lines)
    const container = DockerService.docker.getContainer(instance.container_id)
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100,
      timestamps: true
    })

    res.json({
      success: true,
      data: {
        logs: logs.toString('utf8')
      }
    })

  } catch (error) {
    logger.error('Get instance logs error:', error)
    next(error)
  }
})

module.exports = router