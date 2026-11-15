import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearCaches, parseForESLint } from '@typescript-eslint/parser';

describe('lint parser project-service allowlist compatibility', () => {
  let root: string;

  beforeEach(() => {
    clearCaches();
    root = mkdtempSync(join(tmpdir(), 'caat-lint-compat-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'main.ts'), 'export const included = true;');
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true }, include: ['src/**/*.ts'],
    }));
  });

  afterEach(() => {
    clearCaches();
    rmSync(root, { recursive: true, force: true });
  });

  it.each(['config.ts', '.config.ts'])('retains type information for allowlisted %s outside tsconfig', (name) => {
    const filePath = join(root, name);
    const code = 'const value: number = "not a number";';
    writeFileSync(filePath, code);
    const parsed = parseForESLint(code, {
      filePath, tsconfigRootDir: root,
      projectService: { allowDefaultProject: ['*.ts'] },
    });
    const program = parsed.services.program;
    expect(program).toBeTruthy();
    const source = program!.getSourceFile(filePath);
    expect(source).toBeTruthy();
    // A real checker diagnostic proves the allowlisted file has type information.
    expect(program!.getSemanticDiagnostics(source).some(d => d.code === 2322)).toBe(true);
  });

  it('rejects a file outside both the tsconfig and the default-project allowlist', () => {
    const filePath = join(root, 'unlisted.ts');
    const code = 'const value = 1;';
    writeFileSync(filePath, code);
    expect(() => parseForESLint(code, {
      filePath, tsconfigRootDir: root,
      projectService: { allowDefaultProject: ['config.ts'] },
    })).toThrow(/not found by the project service/);
  });
});
