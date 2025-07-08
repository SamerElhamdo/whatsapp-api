const { sequelize } = require('../config/database')

// Import models
const User = require('./User')
const SubscriptionPlan = require('./SubscriptionPlan')
const Subscription = require('./Subscription')
const Session = require('./Session')
const Instance = require('./Instance')
const MessageLog = require('./MessageLog')
const ApiKey = require('./ApiKey')
const Webhook = require('./Webhook')
const UsageStats = require('./UsageStats')

// Initialize models
const models = {
  User: User(sequelize),
  SubscriptionPlan: SubscriptionPlan(sequelize),
  Subscription: Subscription(sequelize),
  Session: Session(sequelize),
  Instance: Instance(sequelize),
  MessageLog: MessageLog(sequelize),
  ApiKey: ApiKey(sequelize),
  Webhook: Webhook(sequelize),
  UsageStats: UsageStats(sequelize)
}

// Define associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models)
  }
})

// Add sequelize instance
models.sequelize = sequelize

module.exports = models