import { assertTestDatabase } from './assert-test-database';

describe('test database boundary', () => {
  it.each(['postgresql://user:pass@localhost:55432/dentalwarner', 'postgresql://user:pass@example.com/app_test', undefined])(
    'rejects development or remote targets', url => expect(() => assertTestDatabase(url)).toThrow()
  );
  it('accepts an explicitly isolated local test database', () => {
    const url = 'postgresql://user:pass@127.0.0.1:55432/dentalwarner_test_security';
    expect(assertTestDatabase(url)).toBe(url);
  });
});
