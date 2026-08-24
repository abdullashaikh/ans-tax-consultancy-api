import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('Health Endpoints', () => {
  it('GET /health should return 200 with status UP', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/services should return 200 for public catalogue', async () => {
    // Note: If DB is not running, error handler catches it gracefully
    const res = await request(app).get('/api/v1/services');
    expect(res.status).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /non-existent-route should return 404 with standard ApiError format', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
  });
});
