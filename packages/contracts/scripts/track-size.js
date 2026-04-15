#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

function getDirectorySize(dirPath) {
  let totalSize = 0

  function calculateSize(path) {
    const stats = statSync(path)
    if (stats.isFile()) {
      totalSize += stats.size
    } else if (stats.isDirectory()) {
      const files = readdirSync(path)
      for (const file of files) {
        calculateSize(join(path, file))
      }
    }
  }

  calculateSize(dirPath)
  return totalSize
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const logPath = '.size-log.json'

// Calculate package size (exports directory)
const exportsSize = getDirectorySize('exports')

// Calculate node_modules size
const nodeModulesSize = existsSync('node_modules') ? getDirectorySize('node_modules') : 0

// Count dependencies
const deps = Object.keys(pkg.dependencies || {}).length
const devDeps = Object.keys(pkg.devDependencies || {}).length
const totalDeps = deps + devDeps

// Create entry
const entry = {
  version: pkg.version,
  timestamp: new Date().toISOString(),
  size: {
    bytes: exportsSize,
    formatted: formatBytes(exportsSize)
  },
  nodeModules: {
    bytes: nodeModulesSize,
    formatted: formatBytes(nodeModulesSize)
  },
  dependencies: {
    production: deps,
    development: devDeps,
    total: totalDeps
  }
}

// Load existing log or create new one
let log = { entries: [] }
if (existsSync(logPath)) {
  try {
    log = JSON.parse(readFileSync(logPath, 'utf-8'))
  } catch (e) {
    console.warn('Could not read existing log, creating new one')
  }
}

// Add new entry
log.entries.push(entry)

// Keep only last 50 entries
if (log.entries.length > 50) {
  log.entries = log.entries.slice(-50)
}

// Save log
writeFileSync(logPath, JSON.stringify(log, null, 2))

// Display summary
console.log('\n📦 Package Size Tracking')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Version:           ${entry.version}`)
console.log(`Build Size:        ${entry.size.formatted}`)
console.log(`node_modules:      ${entry.nodeModules.formatted}`)
console.log(
  `Dependencies:      ${entry.dependencies.production} prod + ${entry.dependencies.development} dev = ${entry.dependencies.total} total`
)

// Show trend if we have previous entries
if (log.entries.length > 1) {
  const prev = log.entries[log.entries.length - 2]
  const sizeDiff = entry.size.bytes - prev.size.bytes
  const depDiff = entry.dependencies.total - prev.dependencies.total

  if (sizeDiff !== 0) {
    const sign = sizeDiff > 0 ? '+' : ''
    console.log(
      `Size Change:       ${sign}${formatBytes(Math.abs(sizeDiff))} (${sign}${(
        (sizeDiff / prev.size.bytes) *
        100
      ).toFixed(1)}%)`
    )
  }

  const nodeModulesDiff = entry.nodeModules.bytes - (prev.nodeModules?.bytes || 0)
  if (nodeModulesDiff !== 0 && prev.nodeModules) {
    const sign = nodeModulesDiff > 0 ? '+' : ''
    console.log(
      `node_modules:      ${sign}${formatBytes(Math.abs(nodeModulesDiff))} (${sign}${(
        (nodeModulesDiff / prev.nodeModules.bytes) *
        100
      ).toFixed(1)}%)`
    )
  }

  if (depDiff !== 0) {
    const sign = depDiff > 0 ? '+' : ''
    console.log(`Dependency Change: ${sign}${depDiff}`)
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
