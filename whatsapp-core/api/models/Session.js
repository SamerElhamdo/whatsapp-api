const { DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const Session = sequelize.define('Session', {
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
    session_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        is: /^[a-zA-Z0-9_-]+$/i // Only alphanumeric, underscore, and dash
      }
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    qr_code: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    session_data_path: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'authenticated', 'disconnected', 'error'),
      allowNull: false,
      defaultValue: 'pending'
    },
    last_seen: {
      type: DataTypes.DATE,
      allowNull: true
    },
    webhook_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false
    }
  }, {
    tableName: 'sessions',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'session_name']
      }
    ]
  })

  // Instance methods
  Session.prototype.isAuthenticated = function() {
    return this.status === 'authenticated'
  }

  Session.prototype.isConnected = function() {
    return this.status === 'authenticated' && 
           this.last_seen && 
           (new Date() - new Date(this.last_seen)) < 5 * 60 * 1000 // 5 minutes
  }

  Session.prototype.getStoragePath = function() {
    const storagePath = process.env.SESSION_STORAGE_PATH || './storage/sessions'
    return `${storagePath}/${this.user_id}/${this.session_name}`
  }

  Session.prototype.updateStatus = async function(status, additionalData = {}) {
    const updateData = { 
      status,
      last_seen: new Date(),
      ...additionalData 
    }
    
    return await this.update(updateData)
  }

  // Define associations
  Session.associate = (models) => {
    // Session belongs to user
    Session.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    })

    // Session has many instances
    Session.hasMany(models.Instance, {
      foreignKey: 'session_id',
      as: 'instances'
    })

    // Session has many message logs
    Session.hasMany(models.MessageLog, {
      foreignKey: 'session_id',
      as: 'messageLogs'
    })

    // Session has many webhooks
    Session.hasMany(models.Webhook, {
      foreignKey: 'session_id',
      as: 'webhooks'
    })
  }

  return Session
}