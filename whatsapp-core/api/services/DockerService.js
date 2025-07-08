/**
 * Docker Service
 * يدير إنشاء وتوسيع WhatsApp instances
 */

const Docker = require('dockerode')
const { Instance } = require('../models')
const logger = require('../config/logger')

class DockerService {
  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock'
    })
    this.whatsappImage = process.env.WHATSAPP_IMAGE || 'whatsapp-instance:latest'
    this.networkName = process.env.DOCKER_NETWORK || 'saas_network'
  }

  /**
   * بناء صورة WhatsApp Instance
   */
  async buildWhatsAppImage() {
    try {
      logger.info('Building WhatsApp instance image...')
      
      const stream = await this.docker.buildImage({
        context: '../whatsapp-instance',
        src: ['Dockerfile', 'instance-wrapper.js', 'package.json']
      }, {
        t: this.whatsappImage
      })

      // انتظار انتهاء البناء
      await new Promise((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err)
          else resolve(res)
        })
      })

      logger.info('✅ WhatsApp instance image built successfully')
      return true

    } catch (error) {
      logger.error('❌ Failed to build WhatsApp instance image:', error)
      throw error
    }
  }

  /**
   * إنشاء instance جديدة
   */
  async createInstance(instanceData) {
    try {
      const { id, user_id, session_id, container_name, port } = instanceData

      logger.info(`Creating Docker container: ${container_name}`)

      // إعدادات الحاوية
      const containerConfig = {
        Image: this.whatsappImage,
        name: container_name,
        Hostname: container_name,
        ExposedPorts: {
          '3000/tcp': {}
        },
        Env: [
          `INSTANCE_ID=${id}`,
          `INSTANCE_PORT=3000`,
          `USER_ID=${user_id}`,
          `SESSION_ID=${session_id}`,
          `GATEWAY_URL=http://gateway_api:3000`,
          `SESSION_PATH=/app/storage/sessions/${user_id}/${session_id}`,
          `NODE_ENV=${process.env.NODE_ENV || 'production'}`
        ],
        HostConfig: {
          PortBindings: {
            '3000/tcp': [{ HostPort: port.toString() }]
          },
          Memory: parseInt(process.env.DEFAULT_INSTANCE_MEMORY) * 1024 * 1024 || 512 * 1024 * 1024, // 512MB
          CpuShares: parseInt(process.env.DEFAULT_INSTANCE_CPU) * 1024 || 512, // 0.5 CPU
          NetworkMode: this.networkName,
          RestartPolicy: {
            Name: 'unless-stopped'
          },
          Binds: [
            // ربط تخزين الجلسات
            `session_storage:/app/storage/sessions`,
            // ربط logs
            `instance_logs:/app/logs`
          ]
        },
        NetworkingConfig: {
          EndpointsConfig: {
            [this.networkName]: {
              Aliases: [container_name]
            }
          }
        },
        Labels: {
          'whatsapp.saas.instance': 'true',
          'whatsapp.saas.user_id': user_id,
          'whatsapp.saas.session_id': session_id,
          'whatsapp.saas.instance_id': id
        }
      }

      // إنشاء الحاوية
      const container = await this.docker.createContainer(containerConfig)
      
      // تشغيل الحاوية
      await container.start()

      // تحديث Instance في قاعدة البيانات
      await Instance.update({
        container_id: container.id,
        status: 'starting'
      }, {
        where: { id }
      })

      logger.info(`✅ Container created and started: ${container_name}`)
      return {
        container_id: container.id,
        container_name,
        port,
        status: 'starting'
      }

    } catch (error) {
      logger.error('❌ Failed to create instance:', error)
      throw error
    }
  }

  /**
   * إيقاف instance
   */
  async stopInstance(containerId) {
    try {
      const container = this.docker.getContainer(containerId)
      
      // إيقاف graceful
      await container.stop({ t: 10 }) // انتظار 10 ثوان
      
      logger.info(`✅ Container stopped: ${containerId}`)
      return true

    } catch (error) {
      logger.error('❌ Failed to stop container:', error)
      throw error
    }
  }

  /**
   * حذف instance
   */
  async removeInstance(containerId) {
    try {
      const container = this.docker.getContainer(containerId)
      
      // إيقاف أولاً إذا كان يعمل
      try {
        await container.stop({ t: 5 })
      } catch (stopError) {
        // الحاوية قد تكون متوقفة بالفعل
      }
      
      // حذف الحاوية
      await container.remove({ force: true })
      
      logger.info(`✅ Container removed: ${containerId}`)
      return true

    } catch (error) {
      logger.error('❌ Failed to remove container:', error)
      throw error
    }
  }

  /**
   * إعادة تشغيل instance
   */
  async restartInstance(containerId) {
    try {
      const container = this.docker.getContainer(containerId)
      await container.restart({ t: 10 })
      
      logger.info(`✅ Container restarted: ${containerId}`)
      return true

    } catch (error) {
      logger.error('❌ Failed to restart container:', error)
      throw error
    }
  }

  /**
   * الحصول على إحصائيات instance
   */
  async getInstanceStats(containerId) {
    try {
      const container = this.docker.getContainer(containerId)
      const stats = await container.stats({ stream: false })
      
      return {
        cpu_usage: this.calculateCpuUsage(stats),
        memory_usage: stats.memory_stats.usage / 1024 / 1024, // MB
        network_rx: stats.networks?.eth0?.rx_bytes || 0,
        network_tx: stats.networks?.eth0?.tx_bytes || 0
      }

    } catch (error) {
      logger.error('❌ Failed to get container stats:', error)
      return null
    }
  }

  /**
   * حساب استخدام CPU
   */
  calculateCpuUsage(stats) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
    const numberCpus = stats.cpu_stats.online_cpus || 1
    
    return (cpuDelta / systemDelta) * numberCpus * 100.0
  }

  /**
   * فحص صحة جميع instances
   */
  async healthCheckAll() {
    try {
      const instances = await Instance.findAll({
        where: { status: ['starting', 'running'] }
      })

      const healthChecks = instances.map(async (instance) => {
        if (!instance.container_id) return

        try {
          const container = this.docker.getContainer(instance.container_id)
          const info = await container.inspect()
          
          const isRunning = info.State.Running
          const stats = await this.getInstanceStats(instance.container_id)
          
          // تحديث حالة Instance
          await instance.updateHealthStatus(
            isRunning ? 'healthy' : 'unhealthy',
            stats
          )

          if (!isRunning && instance.status === 'running') {
            await instance.updateStatus('stopped')
          }

        } catch (error) {
          logger.error(`Health check failed for instance ${instance.id}:`, error.message)
          await instance.updateHealthStatus('unhealthy')
        }
      })

      await Promise.all(healthChecks)
      logger.info('✅ Health check completed for all instances')

    } catch (error) {
      logger.error('❌ Failed to perform health check:', error)
    }
  }

  /**
   * تنظيف instances المتوقفة
   */
  async cleanupStoppedInstances() {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: ['whatsapp.saas.instance=true'],
          status: ['exited', 'dead']
        }
      })

      const cleanupTasks = containers.map(async (containerInfo) => {
        try {
          const container = this.docker.getContainer(containerInfo.Id)
          await container.remove({ force: true })
          
          // تحديث Instance في قاعدة البيانات
          await Instance.update({
            status: 'stopped',
            stopped_at: new Date()
          }, {
            where: { container_id: containerInfo.Id }
          })

          logger.info(`🗑️ Cleaned up stopped container: ${containerInfo.Id}`)

        } catch (error) {
          logger.error(`Failed to cleanup container ${containerInfo.Id}:`, error.message)
        }
      })

      await Promise.all(cleanupTasks)
      logger.info('✅ Cleanup completed')

    } catch (error) {
      logger.error('❌ Failed to cleanup stopped instances:', error)
    }
  }

  /**
   * الحصول على إحصائيات عامة
   */
  async getSystemStats() {
    try {
      const info = await this.docker.info()
      
      return {
        containers_running: info.ContainersRunning,
        containers_total: info.Containers,
        images_count: info.Images,
        memory_total: info.MemTotal,
        cpu_count: info.NCPU
      }

    } catch (error) {
      logger.error('❌ Failed to get system stats:', error)
      return null
    }
  }

  /**
   * تشغيل مراقب دوري
   */
  startMonitoring() {
    // فحص صحة كل دقيقتين
    setInterval(() => {
      this.healthCheckAll()
    }, 2 * 60 * 1000)

    // تنظيف كل 10 دقائق
    setInterval(() => {
      this.cleanupStoppedInstances()
    }, 10 * 60 * 1000)

    logger.info('🔄 Docker monitoring started')
  }
}

module.exports = new DockerService()