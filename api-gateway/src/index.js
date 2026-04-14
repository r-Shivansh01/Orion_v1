require('dotenv').config();
const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');
const { connect: connectRabbitMQ } = require('./lib/rabbitmq');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();
const port = process.env.PORT || 4000;

// Prometheus metrics setup
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'orion_api_gateway_' });

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Middleware
app.use(cors());
app.use(express.json());

// Metrics middleware
app.use((req, res, next) => {
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    httpRequestsTotal.labels(req.method, route, res.statusCode).inc();
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
});

// Start server and connect to RabbitMQ
async function startServer() {
  try {
    // Connect to RabbitMQ with exponential backoff
    await connectRabbitMQ();
    
    app.listen(port, () => {
      console.log(`API Gateway listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start API Gateway:', error);
    process.exit(1);
  }
}

startServer();
