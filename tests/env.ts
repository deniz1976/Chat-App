process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'chat_app_test';
