import { createChunkedStorage } from '@/lib/auth-storage';
jest.mock('expo-crypto', () => ({ randomUUID: () => 'abcdef-1234' }));
function store() {
  const data = new Map<string, string>();
  return { data, getItemAsync: async (k: string) => data.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => { if (Buffer.byteLength(v, 'utf8') > 2048) throw new Error('oversize'); data.set(k, v); },
    deleteItemAsync: async (k: string) => { data.delete(k); } };
}
it('roundtrips large native sessions with Unicode within the SecureStore limit and erases all chunks', async () => {
  const native = store(); const storage = createChunkedStorage(native);
  const value = JSON.stringify({ access_token: 'x'.repeat(6000), user: { name: '🥾'.repeat(2000) } });
  await storage.setItem('session', value);
  expect(await storage.getItem('session')).toBe(value);
  await storage.removeItem('session'); expect(native.data.size).toBe(0);
});
it('rejects incomplete storage instead of reconstructing mixed tokens', async () => {
  const native = store(); const storage = createChunkedStorage(native);
  await storage.setItem('session', 'x'.repeat(1000));
  native.data.delete('session.abcdef-1234.1');
  await expect(storage.getItem('session')).rejects.toThrow('Incomplete');
});
