import { HttpStatusError } from '@/lib/api';

describe('readable service errors', () => {
  it('offers recovery for server errors while retaining the response for diagnostics', () => {
    const body = '{"error":{"message":"internal database failure"}}';
    const error = new HttpStatusError(500, body, body);
    expect(error.message).toContain('Bitte versuche es später erneut');
    expect(error.message).not.toContain('database');
    expect(error.body).toBe(body);
    expect(error.status).toBe(500);
  });
  it('preserves actionable validation text without the OData envelope', () => {
    expect(new HttpStatusError(400, '{"error":{"message":"Bitte gib einen Namen ein."}}').message)
      .toBe('Bitte gib einen Namen ein.');
  });
  it('keeps missing-user detection compatible', () => {
    expect(new HttpStatusError(404, '{"error":{"message":"Users not found"}}').message)
      .toBe('Users not found');
  });
  it('explains insufficient permissions', () => {
    expect(new HttpStatusError(403, 'Forbidden').message).toContain('Berechtigung');
  });
});
