import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          moduleResolution: 'node',
          module: 'commonjs',
        },
      },
    ],
    // jose is ESM-only; transform it via babel-jest using a dedicated config
    // that does NOT conflict with Next.js (babel.config.js is not present in root)
    '^.+\\.js$': [
      'babel-jest',
      {
        configFile: './jest.babel.config.js',
      },
    ],
  },
  // Allow transforming jose (ESM package) by overriding the default ignore pattern
  transformIgnorePatterns: [
    '/node_modules/(?!(jose)/)',
  ],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    'app/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
};

export default config;
