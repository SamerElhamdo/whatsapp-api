const { DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const Webhook = sequelize.define('Webhook', {
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
      allowNull: true,
      references: {
        model: 'sessions',
        key: 'id'
      }
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        isUrl: true
      }
    },
    events: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: ['message', 'status']
    },
    secret: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    retry_count: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      validate: {
        min: 0,
        max: 10
      }
    },
    timeout_seconds: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      validate: {
        min: 5,
        max: 120
      }
    },
    last_triggered: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'webhooks'
  })

  // Define associations
  Webhook.associate = (models) => {
    Webhook.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    })

    Webhook.belongsTo(models.Session, {
      foreignKey: 'session_id',
      as: 'session'
    })
  }

  return Webhook
}