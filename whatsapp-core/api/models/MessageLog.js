const { DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const MessageLog = sequelize.define('MessageLog', {
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
    instance_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'instances',
        key: 'id'
      }
    },
    message_type: {
      type: DataTypes.ENUM('text', 'image', 'video', 'audio', 'document', 'location', 'contact'),
      allowNull: false
    },
    recipient: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'read', 'failed'),
      allowNull: false
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false
    }
  }, {
    tableName: 'message_logs',
    indexes: [
      {
        fields: ['user_id', 'created_at']
      },
      {
        fields: ['session_id', 'created_at']
      },
      {
        fields: ['status']
      }
    ]
  })

  // Define associations
  MessageLog.associate = (models) => {
    MessageLog.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    })

    MessageLog.belongsTo(models.Session, {
      foreignKey: 'session_id',
      as: 'session'
    })

    MessageLog.belongsTo(models.Instance, {
      foreignKey: 'instance_id',
      as: 'instance'
    })
  }

  return MessageLog
}