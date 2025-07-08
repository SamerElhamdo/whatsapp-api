const { DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const UsageStats = sequelize.define('UsageStats', {
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    messages_sent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    messages_received: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    api_calls: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    instance_hours: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    storage_used: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    }
  }, {
    tableName: 'usage_stats',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'date']
      }
    ]
  })

  // Define associations
  UsageStats.associate = (models) => {
    UsageStats.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    })
  }

  return UsageStats
}