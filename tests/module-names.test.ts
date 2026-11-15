import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * macOS and Windows disks ignore case. There, an import of './Caption.js' finds caption.ts
 * before Caption.tsx, so two source files whose names differ only by case or by .ts/.tsx
 * load the wrong module. Linux does not show the problem, so this test does.
 */
describe('source file names', () => {
  it('has no two modules that differ only by case or by .ts/.tsx', () => {
    const files = execFileSync('git', ['ls-files', '*.ts', '*.tsx'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f !== '' && !f.endsWith('.d.ts'));
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const file of files) {
      const key = file.replace(/\.tsx?$/, '').toLowerCase();
      const other = seen.get(key);
      if (other !== undefined) clashes.push(`${other} <-> ${file}`);
      else seen.set(key, file);
    }
    expect(clashes).toEqual([]);
  });
});
