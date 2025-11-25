module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
};
