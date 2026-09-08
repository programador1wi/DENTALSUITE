export function assertTestDatabase(connectionString: string | undefined): string {
  if (!connectionString) throw new Error('A dedicated test database URL is required');
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(url.hostname) ||
      !/(?:^|_)(?:test|ci)(?:_|$)/i.test(name)) {
    throw new Error('Refusing database writes: a local database explicitly named test or ci is required');
  }
  return connectionString;
}
