// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_minimum_32_characters_long_123456';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_minimum_32_characters_long_123456';
process.env.COOKIE_SECRET = 'test_cookie_secret_key_minimum_32_characters_long_1234567890';

// Mock console logger during tests to keep output clean
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
