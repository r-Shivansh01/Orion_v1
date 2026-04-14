const express = require('express');
const prisma = require('../lib/prisma');
const { publishMessage } = require('../lib/rabbitmq');
const authMiddleware = require('../middleware/auth');
const promClient = require('prom-client');

const router = express.Router();

// Metrics
const tasksCreatedCounter = new promClient.Counter({
  name: 'task_created_total',
  help: 'Total number of tasks created'
});

const tasksCompletedCounter = new promClient.Counter({
  name: 'task_completed_total',
  help: 'Total number of tasks completed'
});

const tasksFailedCounter = new promClient.Counter({
  name: 'task_failed_total',
  help: 'Total number of tasks failed'
});

const activeJobsGauge = new promClient.Gauge({
  name: 'active_jobs_total',
  help: 'Total number of active jobs'
});

// Use authMiddleware for all routes below
router.use(authMiddleware);

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ message: 'Prompt is required' });
  }
  
  try {
    const job = await prisma.job.create({
      data: {
        userId: req.user.id,
        prompt,
        status: 'PENDING'
      }
    });
    
    // Publish to RabbitMQ
    await publishMessage('task.created', {
      id: job.id,
      prompt: job.prompt,
      user_id: job.userId
    });
    
    tasksCreatedCounter.inc();
    activeJobsGauge.inc();
    
    res.status(201).json({
      job_id: job.id,
      status: job.status,
      created_at: job.createdAt
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ message: 'Internal server error during task creation' });
  }
});

/**
 * GET /api/tasks
 * List all jobs for the current user
 */
router.get('/', async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(jobs);
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ message: 'Internal server error while fetching tasks' });
  }
});

/**
 * GET /api/tasks/failed
 * List all failed jobs for the current user (DLQ Inspector)
 * CRITICAL: Must be defined BEFORE /api/tasks/:id
 */
router.get('/failed', async (req, res) => {
  try {
    const failedJobs = await prisma.job.findMany({
      where: { 
        userId: req.user.id,
        status: 'FAILED'
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        prompt: true,
        status: true,
        qaFeedback: true,
        qaSeverity: true,
        retryCount: true,
        createdAt: true,
        updatedAt: true
      }
    });
    res.json(failedJobs);
  } catch (error) {
    console.error('Fetch failed tasks error:', error);
    res.status(500).json({ message: 'Internal server error while fetching failed tasks' });
  }
});

/**
 * GET /api/tasks/:id
 * Get details of a specific job
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const job = await prisma.job.findFirst({
      where: { 
        id,
        userId: req.user.id
      }
    });
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    res.json(job);
  } catch (error) {
    console.error('Fetch task error:', error);
    res.status(500).json({ message: 'Internal server error while fetching task details' });
  }
});

/**
 * GET /api/tasks/:id/replay
 * Get the full event log for a job
 */
router.get('/:id/replay', async (req, res) => {
  const { id } = req.params;
  
  try {
    const job = await prisma.job.findFirst({
      where: { 
        id,
        userId: req.user.id
      },
      select: {
        id: true,
        prompt: true,
        status: true,
        eventLog: true
      }
    });
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    res.json({
      job_id: job.id,
      prompt: job.prompt,
      status: job.status,
      event_log: job.eventLog
    });
  } catch (error) {
    console.error('Fetch replay error:', error);
    res.status(500).json({ message: 'Internal server error while fetching replay data' });
  }
});

module.exports = router;
