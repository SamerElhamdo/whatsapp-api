const { DataTypes } = require('sequelize')
const crypto = require('crypto')

module.exports = (sequelize) => {
  const ApiKey = sequelize.define('ApiKey', {
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
    key_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100]
      }
    },
    api_key: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false
    },
    last_used: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'api_keys',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'key_name']
      },
      {
        fields: ['api_key']
      }
    ],
    hooks: {
      beforeCreate: (apiKey) => {
        if (!apiKey.api_key) {
          apiKey.api_key = ApiKey.generateApiKey()
        }
      }
    }
  })

  // Static methods
  ApiKey.generateApiKey = () => {
    const prefix = 'wsa_' // WhatsApp SaaS API
    const randomString = crypto.randomBytes(32).toString('hex')
    return prefix + randomString
  }

  // Instance methods
  ApiKey.prototype.isExpired = function() {
    return this.expires_at && new Date() > this.expires_at
  }

  ApiKey.prototype.hasPermission = function(permission) {
    return this.permissions && this.permissions[permission] === true
  }

  // Define associations
  ApiKey.associate = (models) => {
    ApiKey.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    })
  }

  return ApiKey
}