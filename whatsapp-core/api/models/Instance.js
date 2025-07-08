const { DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const Instance = sequelize.define('Instance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'sessions',
        key: 'id'
      }
    },
    container_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true
    },
    container_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      validate: {
        min: 1000,
        max: 65535
      }
    },
    status: {
      type: DataTypes.ENUM('starting', 'running', 'stopping', 'stopped', 'error'),
      allowNull: false,
      defaultValue: 'starting'
    },
    health_status: {
      type: DataTypes.ENUM('healthy', 'unhealthy', 'unknown'),
      defaultValue: 'unknown'
    },
    cpu_usage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00,
      validate: {
        min: 0,
        max: 100
      }
    },
    memory_usage: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    last_health_check: {
      type: DataTypes.DATE,
      allowNull: true
    },
    started_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    stopped_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'instances',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'session_id']
      }
    ]
  })

  // Instance methods
  Instance.prototype.isRunning = function() {
    return this.status === 'running'
  }

  Instance.prototype.isHealthy = function() {
    return this.health_status === 'healthy' && 
           this.last_health_check && 
           (new Date() - new Date(this.last_health_check)) < 2 * 60 * 1000 // 2 minutes
  }

  Instance.prototype.getApiUrl = function() {
    return `http://localhost:${this.port}`
  }

  Instance.prototype.updateHealthStatus = async function(status, metrics = {}) {
    const updateData = {
      health_status: status,
      last_health_check: new Date(),
      ...metrics
    }
    
    return await this.update(updateData)
  }

  Instance.prototype.updateStatus = async function(status) {
    const updateData = { status }
    
    if (status === 'running') {
      updateData.started_at = new Date()
      updateData.stopped_at = null
    } else if (status === 'stopped') {
      updateData.stopped_at = new Date()
    }
    
    return await this.update(updateData)
  }

  Instance.prototype.getUptime = function() {
    if (!this.started_at || this.status !== 'running') return 0
    return Math.floor((new Date() - new Date(this.started_at)) / 1000)
  }

  // Define associations
  Instance.associate = (models) => {
    // Instance belongs to user
    Instance.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    })

    // Instance belongs to session
    Instance.belongsTo(models.Session, {
      foreignKey: 'session_id',
      as: 'session'
    })

    // Instance has many message logs
    Instance.hasMany(models.MessageLog, {
      foreignKey: 'instance_id',
      as: 'messageLogs'
    })
  }

  return Instance
}