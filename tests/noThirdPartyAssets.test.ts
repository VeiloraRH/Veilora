import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Hosts the browser must not load from: each request would hand the visitor's IP to a third party.
const BLOCKED = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cloudfront.net', 'assets.relay.link'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(tsx?|css|html)$/.test(name) ? [path] : [];
  });
}

describe('no third-party asset hosts', () => {
  test('index.html and src load fonts, models and icons from Veilora only', () => {
    const offenders = ['index.html', ...files('src')].filter((path) => {
      const text = readFileSync(path, 'utf8');
      return BLOCKED.some((host) => text.includes(host));
    });
    expect(offenders).toEqual([]);
  });
});
