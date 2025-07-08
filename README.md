# WhatsApp Web API - Monorepo

## 📁 Project Structure

This project has been organized into a **monorepo** with two main components:

```
whatsapp-web-api/
├── gateway/              # API Gateway - Main entry point
│   ├── controllers/      # API controllers
│   ├── middleware.js     # Express middleware
│   ├── routes.js         # API routes
│   ├── sessions.js       # Session management
│   ├── utils.js          # Utility functions
│   ├── app.js            # Express app configuration
│   ├── config.js         # Configuration
│   ├── server.js         # Main server entry point
│   ├── swagger.js        # Swagger documentation generator
│   ├── swagger.json      # Swagger API documentation
│   └── package.json      # Gateway dependencies
├── whatsapp-core/        # WhatsApp Core Service
│   ├── api/              # WhatsApp-specific API
│   ├── database/         # Database configurations
│   ├── instance-wrapper.js # WhatsApp instance management
│   └── package.json      # Core dependencies
├── assets/               # Shared assets
├── tests/                # Test files
├── docker-compose.yml    # Docker configuration
├── Dockerfile           # Docker build instructions
└── package.json         # Root package.json (workspace manager)
```

## 🏗️ Architecture Overview

### Gateway Service
- **Purpose**: API management, routing, authentication, and image processing
- **Key Features**:
  - RESTful API endpoints
  - Request/response middleware
  - Session management
  - Swagger documentation
  - Rate limiting
  - Image handling from WhatsApp core

### WhatsApp Core Service
- **Purpose**: WhatsApp Web.js integration and instance management
- **Key Features**:
  - WhatsApp Web.js wrapper
  - Instance lifecycle management
  - Message handling
  - QR code generation
  - WhatsApp-specific operations

## � Getting Started

### Prerequisites
- Node.js >= 14.17.0
- npm or yarn

### Installation

1. **Install all dependencies**:
   ```bash
   npm run install:all
   ```

2. **Start the Gateway** (main API):
   ```bash
   npm start
   # or
   npm run start:gateway
   ```

3. **Start the WhatsApp Core** (if needed separately):
   ```bash
   npm run start:core
   ```

### Development

- **Gateway Development**: The gateway handles all API requests and manages the WhatsApp core service
- **Core Development**: The core service focuses on WhatsApp Web.js integration

## � API Documentation

The API documentation is available via Swagger UI when the gateway is running:
- **URL**: `http://localhost:3000/api-docs`
- **Generate Swagger**: `npm run swagger`

## � Configuration

Configuration files are located in:
- `gateway/config.js` - Gateway-specific configuration
- `whatsapp-core/` - Core service configuration

## � Docker Support

The project includes Docker support:
```bash
docker-compose up -d
```

## 🧪 Testing

Run tests for the gateway:
```bash
npm test
```

## 📝 Scripts

- `npm start` - Start the gateway service
- `npm run start:gateway` - Start the gateway service
- `npm run start:core` - Start the WhatsApp core service
- `npm run install:all` - Install all workspace dependencies
- `npm test` - Run gateway tests
- `npm run swagger` - Generate Swagger documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request

## � License

This project is licensed under the MIT License.

## 🔗 Key Benefits of This Structure

1. **Separation of Concerns**: Gateway handles API management while Core handles WhatsApp integration
2. **Scalability**: Each service can be scaled independently
3. **Maintainability**: Clear separation makes code easier to maintain
4. **Image Processing**: Gateway efficiently handles image processing from WhatsApp core
5. **Modularity**: Components can be developed and deployed independently

## � Next Steps

1. Configure environment variables for both services
2. Set up database connections in the core service
3. Configure authentication and authorization
4. Set up monitoring and logging
5. Deploy using Docker or your preferred method
