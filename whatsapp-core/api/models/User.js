const { DataTypes } = require('sequelize')
const bcrypt = require('bcryptjs')

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        len: [3, 255]
      }
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [6, 255]
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [2, 255]
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [10, 20]
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    subscription_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash) {
          const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12
          user.password_hash = await bcrypt.hash(user.password_hash, saltRounds)
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash')) {
          const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12
          user.password_hash = await bcrypt.hash(user.password_hash, saltRounds)
        }
      }
    }
  })

  // Instance methods
  User.prototype.comparePassword = async function(password) {
    return bcrypt.compare(password, this.password_hash)
  }

  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get())
    delete values.password_hash
    return values
  }

  // Define associations
  User.associate = (models) => {
    // User has one active subscription
    User.belongsTo(models.Subscription, {
      foreignKey: 'subscription_id',
      as: 'subscription'
    })

    // User has many subscriptions (history)
    User.hasMany(models.Subscription, {
      foreignKey: 'user_id',
      as: 'subscriptions'
    })

    // User has many sessions
    User.hasMany(models.Session, {
      foreignKey: 'user_id',
      as: 'sessions'
    })

    // User has many instances
    User.hasMany(models.Instance, {
      foreignKey: 'user_id',
      as: 'instances'
    })

    // User has many message logs
    User.hasMany(models.MessageLog, {
      foreignKey: 'user_id',
      as: 'messageLogs'
    })

    // User has many API keys
    User.hasMany(models.ApiKey, {
      foreignKey: 'user_id',
      as: 'apiKeys'
    })

    // User has many webhooks
    User.hasMany(models.Webhook, {
      foreignKey: 'user_id',
      as: 'webhooks'
    })

    // User has many usage stats
    User.hasMany(models.UsageStats, {
      foreignKey: 'user_id',
      as: 'usageStats'
    })
  }

  return User
}