import { isRegularStamp } from '@/lib/stamp-kind';
test('only regular HWN identities count for general progress, with legacy support', () => {
  expect(isRegularStamp({ number: '001' })).toBe(true);
  expect(isRegularStamp({ number: '222', stampKind: 'regular' })).toBe(true);
  expect(isRegularStamp({ number: '1', stampKind: 'special' })).toBe(false);
  expect(isRegularStamp({ number: '9901' })).toBe(false);
  expect(isRegularStamp({ number: 'SX-Jungborn' })).toBe(false);
});
