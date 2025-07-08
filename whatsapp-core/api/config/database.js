const { Sequelize } = require('sequelize')
const logger = require('./logger')

// Database configuration
const sequelize = new Sequelize(
  process.env.DB_NAME || 'whatsapp_saas',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? 
      (msg) => logger.debug(msg) : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
)

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate()
    logger.info('Database connection has been established successfully.')
  } catch (error) {
    logger.error('Unable to connect to the database:', error)
    throw error
  }
}

module.exports = {
  sequelize,
  testConnection
}