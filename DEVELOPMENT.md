# Development Guide

## 🔧 Project Structure

The project has been reorganized into a **monorepo** with clear separation of concerns:

```
📁 whatsapp-web-api-monorepo/
├── 🚪 gateway/           # API Gateway (Port 3000)
│   ├── controllers/      # API endpoints
│   ├── middleware.js     # Express middleware
│   ├── routes.js         # API routing
│   ├── sessions.js       # Session management
│   ├── server.js         # Main server entry
│   └── swagger.js        # API documentation
├── 🔄 whatsapp-core/     # WhatsApp Core (Port 4000)
│   ├── api/              # WhatsApp-specific API
│   ├── database/         # Database configs
│   └── instance-wrapper.js # WhatsApp instance manager
├── 🐳 docker-compose.yml # Container orchestration
├── 📦 package.json       # Workspace manager
└── 🚀 start.js          # Main launcher
```

## 🎯 Key Responsibilities

### Gateway Service
- **API Management**: RESTful endpoints for all operations
- **Authentication**: JWT tokens, API keys, session management
- **Image Processing**: Handles image uploads/downloads from WhatsApp
- **Routing**: Directs requests to appropriate handlers
- **Documentation**: Swagger UI at `/api-docs`

### WhatsApp Core Service
- **WhatsApp Integration**: Direct connection to WhatsApp Web.js
- **Instance Management**: Creates and manages WhatsApp instances
- **Message Handling**: Processes incoming/outgoing messages
- **QR Code Generation**: Handles WhatsApp authentication
- **Session Persistence**: Manages WhatsApp session files

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Development Mode
```bash
# Start both services
npm start

# Or start individually
npm run start:gateway  # Port 3000
npm run start:core     # Port 4000
```

### 3. Docker Development
```bash
# Build and start containers
npm run docker:up

# View logs
npm run docker:logs

# Stop containers
npm run docker:down
```

## 🔄 Development Workflow

### Working on Gateway
1. Navigate to `gateway/` folder
2. Make changes to controllers, routes, or middleware
3. Test API endpoints at `http://localhost:3000`
4. Check Swagger docs at `http://localhost:3000/api-docs`

### Working on WhatsApp Core
1. Navigate to `whatsapp-core/` folder
2. Make changes to instance management or WhatsApp logic
3. Test direct connection at `http://localhost:4000`
4. Check logs for WhatsApp Web.js output

## 📊 Communication Flow

```
User Request → Gateway (3000) → WhatsApp Core (4000) → WhatsApp Web.js
```

1. **User** sends request to Gateway API
2. **Gateway** validates, authenticates, and routes request
3. **WhatsApp Core** processes WhatsApp-specific operations
4. **Response** flows back through Gateway to User

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Test specific service
npm run test --workspace=gateway
```

### Manual Testing
```bash
# Health check
curl http://localhost:3000/health

# API documentation
open http://localhost:3000/api-docs
```

## 📁 File Organization

### Gateway Files
- `server.js` - Express server startup
- `app.js` - Express app configuration
- `routes.js` - API route definitions
- `middleware.js` - Express middleware
- `sessions.js` - Session management
- `controllers/` - API endpoint handlers
- `swagger.js` - API documentation generator

### WhatsApp Core Files
- `instance-wrapper.js` - Main WhatsApp instance manager
- `api/` - WhatsApp-specific API endpoints
- `database/` - Database configurations
- `Dockerfile` - Container configuration

## 🔧 Configuration

### Environment Variables
Create `.env` files in both `gateway/` and `whatsapp-core/`:

**Gateway (.env)**
```
PORT=3000
WHATSAPP_CORE_URL=http://localhost:4000
JWT_SECRET=your-secret-key
```

**WhatsApp Core (.env)**
```
PORT=4000
SESSION_PATH=./sessions
```

## 🚀 Deployment

### Single Server
```bash
# Production build
npm run install:all
npm start
```

### Docker Deployment
```bash
# Build and deploy
docker-compose up -d --build
```

### Scaling
- **Gateway**: Can run multiple instances behind load balancer
- **WhatsApp Core**: Handles multiple WhatsApp instances per container

## 📝 Best Practices

1. **Keep services separated** - Don't mix Gateway and Core logic
2. **Use environment variables** - Don't hardcode configurations
3. **Handle errors gracefully** - Always return proper HTTP status codes
4. **Log important events** - Use structured logging
5. **Test thoroughly** - Unit tests for both services
6. **Document API changes** - Update Swagger documentation
7. **Monitor performance** - Track response times and errors

## 🐛 Troubleshooting

### Common Issues

**Gateway won't start**
- Check if port 3000 is available
- Verify dependencies are installed
- Check environment variables

**WhatsApp Core connection fails**
- Ensure WhatsApp Core is running on port 4000
- Check firewall settings
- Verify WhatsApp session files

**Docker issues**
- Run `docker-compose down` and `docker-compose up -d`
- Check container logs with `npm run docker:logs`
- Verify Docker daemon is running

## 📚 Additional Resources

- **Gateway README**: `gateway/README.md`
- **API Documentation**: `http://localhost:3000/api-docs`
- **WhatsApp Web.js Docs**: [Official Documentation](https://wwebjs.dev/)
- **Docker Compose**: [Official Documentation](https://docs.docker.com/compose/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes in appropriate service folder
4. Test both services
5. Submit a pull request

Remember: This is a **monorepo** - keep changes focused and services separated!