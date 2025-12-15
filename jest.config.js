module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test match patterns
  testMatch: [
    '**/test/**/*.test.js',
    '**/test/**/*.spec.js',
    '**/*.test.js',
    '**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'utils/**/*.js',
    'helpers/**/*.js',
    'middlewares/**/*.js',
    'controllers/**/*.js',
    'models/**/*.js',
    '!**/node_modules/**',
    '!**/test/**',
    '!**/coverage/**',
    '!**/scripts/**',
    '!**/config/**',
    '!server.js'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/setup/testSetup.js'],

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Test timeout
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/testScripts/',
    '/test/data/',
    '/test/frontendKeys/'
  ],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true
};