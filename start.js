#!/usr/bin/env node

/**
 * WhatsApp Web API - Monorepo Launcher
 * This script starts the gateway service which is the main entry point
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting WhatsApp Web API...');
console.log('📁 Project Structure: Gateway + WhatsApp Core');
console.log('🔗 Main Entry Point: Gateway Service');
console.log('');

// Change to gateway directory and start the server
const gatewayPath = path.join(__dirname, 'gateway');
const serverProcess = spawn('node', ['server.js'], {
  cwd: gatewayPath,
  stdio: 'inherit'
});

serverProcess.on('error', (error) => {
  console.error('❌ Error starting gateway service:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  console.log(`\n📱 Gateway service exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WhatsApp Web API...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down WhatsApp Web API...');
  serverProcess.kill('SIGTERM');
});