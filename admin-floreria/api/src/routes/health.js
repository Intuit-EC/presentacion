const express = require('express');
const { PrismaClient } = require('@prisma/client');
const packageJson = require('../../package.json');
const emailService = require('../services/emailService');
const { getSmtpPublicStatus } = require('../utils/smtpConfig');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /health
 * Health check endpoint para monitoring
 */
router.get('/', async (req, res) => {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    status: 'OK',
    version: packageJson.version,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100
    },
    services: {
      database: 'unknown',
      api: 'OK'
    }
  };
  // Bello - bello
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = 'OK';
    
    res.status(200).json(healthCheck);
  } catch (error) {
    healthCheck.status = 'ERROR';
    healthCheck.services.database = 'ERROR';
    healthCheck.error = error.message;
    
    res.status(503).json(healthCheck);
  }
});

/**
 * Comprueba autenticación SMTP sin enviar mensajes ni exponer contraseñas.
 */
router.get('/email', async (_req, res) => {
  const smtp = getSmtpPublicStatus();
  const ready = smtp.credentialsConfigured && await emailService.verifyConnection();

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'OK' : 'ERROR',
    service: 'email',
    ready,
    smtp,
  });
});

/**
 * GET /health/detailed
 * Detailed health check con más información
 */
router.get('/detailed', async (req, res) => {
  const detailedCheck = {
    timestamp: new Date().toISOString(),
    status: 'OK',
    version: packageJson.version,
    environment: process.env.NODE_ENV || 'development',
    uptime: {
      seconds: process.uptime(),
      formatted: formatUptime(process.uptime())
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    },
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
      rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100
    },
    services: {
      database: 'unknown',
      api: 'OK'
    }
  };

  try {
    // Test database connection and get stats
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - startTime;
    
    // Get database stats
    const companiesCount = await prisma.company.count();
    const ordersCount = await prisma.order.count();
    
    detailedCheck.services.database = {
      status: 'OK',
      responseTime: `${dbResponseTime}ms`,
      stats: {
        companies: companiesCount,
        orders: ordersCount
      }
    };
    
    res.status(200).json(detailedCheck);
  } catch (error) {
    detailedCheck.status = 'ERROR';
    detailedCheck.services.database = {
      status: 'ERROR',
      error: error.message
    };
    
    res.status(503).json(detailedCheck);
  }
});

/**
 * Función helper para formatear uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

module.exports = router;
