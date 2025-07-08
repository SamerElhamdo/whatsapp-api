const { DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const Subscription = sequelize.define('Subscription', {
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
    plan_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'subscription_plans',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'active'
    },
    started_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    auto_renew: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    payment_method: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false
    }
  }, {
    tableName: 'subscriptions',
    hooks: {
      afterCreate: async (subscription) => {
        // Update user's active subscription
        const user = await subscription.getUser()
        if (user && subscription.status === 'active') {
          await user.update({ subscription_id: subscription.id })
        }
      },
      afterUpdate: async (subscription) => {
        // Update user's active subscription status
        if (subscription.changed('status')) {
          const user = await subscription.getUser()
          if (user) {
            if (subscription.status === 'active') {
              await user.update({ subscription_id: subscription.id })
            } else if (user.subscription_id === subscription.id) {
              // Find another active subscription or set to null
              const activeSubscription = await sequelize.models.Subscription.findOne({
                where: {
                  user_id: user.id,
                  status: 'active'
                },
                order: [['created_at', 'DESC']]
              })
              await user.update({ 
                subscription_id: activeSubscription ? activeSubscription.id : null 
              })
            }
          }
        }
      }
    }
  })

  // Instance methods
  Subscription.prototype.isActive = function() {
    return this.status === 'active' && (!this.expires_at || new Date() < this.expires_at)
  }

  Subscription.prototype.isExpired = function() {
    return this.expires_at && new Date() > this.expires_at
  }

  Subscription.prototype.daysUntilExpiry = function() {
    if (!this.expires_at) return null
    const today = new Date()
    const expiry = new Date(this.expires_at)
    const diffTime = expiry - today
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Define associations
  Subscription.associate = (models) => {
    // Subscription belongs to user
    Subscription.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    })

    // Subscription belongs to plan
    Subscription.belongsTo(models.SubscriptionPlan, {
      foreignKey: 'plan_id',
      as: 'plan'
    })
  }

  return Subscription
}