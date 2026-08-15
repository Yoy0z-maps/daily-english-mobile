module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  collectCoverageFrom: [
    'src/learning/**/*.ts',
    'src/sync/learningSync.ts',
    '!src/**/*.d.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx']
};
