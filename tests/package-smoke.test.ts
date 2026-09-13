import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = 'action-wire';

it('packs installable ESM packages without workspace aliases', () => {
  execFileSync('pnpm', ['--filter', PACKAGE, 'build'], { cwd: root });

  const packageDir = path.join(root, 'packages', PACKAGE);
  for (const file of jsFiles(path.join(packageDir, 'dist'))) {
    expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"]~\//);
  }
  const pkg = readPkg(path.join(packageDir, 'package.json'));
  expect(pkg['files']).toEqual(['dist', 'README.md']);
  expect(pkg['type']).toBe('module');
  expect(pkg['sideEffects']).toBe(false);
  const dependencies = {
    ...asRecord(pkg['dependencies']),
    ...asRecord(pkg['devDependencies']),
    ...asRecord(pkg['peerDependencies']),
  };
  for (const banned of ['react', 'vue', 'svelte', 'livekit-client', 'openai-realtime', 'webrtc']) {
    expect(dependencies[banned], `${PACKAGE} must not depend on ${banned}`).toBeUndefined();
  }

  const packs = mkdtempSync(path.join(tmpdir(), 'webmcp-pack-'));
  const consumer = mkdtempSync(path.join(tmpdir(), 'webmcp-consumer-'));
  try {
    execFileSync('pnpm', ['pack', '--pack-destination', packs], { cwd: packageDir });
    const tarballs = readdirSync(packs).filter((name) => name.endsWith('.tgz'));
    expect(tarballs).toHaveLength(1);
    const widgetTar = tarballs.find((name) => /^action-wire-\d/.test(name));
    expect(widgetTar).toBeDefined();
    if (widgetTar !== undefined) {
      const bytes = statSync(path.join(packs, widgetTar)).size;
      expect(bytes).toBeGreaterThan(0);
      expect(bytes).toBeLessThan(200_000);
    }

    writeFileSync(
      path.join(consumer, 'package.json'),
      `${JSON.stringify({ name: 'webmcp-pack-consumer', private: true, type: 'module' })}\n`,
    );
    execFileSync(
      'npm',
      ['install', '--omit=dev', ...tarballs.map((name) => path.join(packs, name))],
      {
        cwd: consumer,
      },
    );

    const installed = readPkg(path.join(consumer, 'node_modules/action-wire/package.json'));
    expect(JSON.stringify(installed)).not.toContain('workspace:');
    expect(Object.keys(asRecord(installed['dependencies']))).toEqual(['@cfworker/json-schema']);

    const result = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import { createAgentBridge, createAssistant, createWebMCPSource, openAICompatible } from 'action-wire'; console.log([typeof createAgentBridge, typeof createAssistant, typeof createWebMCPSource, typeof openAICompatible].join(' '));",
      ],
      { cwd: consumer, encoding: 'utf8' },
    );
    expect(result.trim()).toBe('function function function function');

    writeFileSync(
      path.join(consumer, 'check.ts'),
      "import { AgentError, createAssistant, createWebMCPSource, openAICompatible } from 'action-wire';\nimport type { ToolSource } from 'action-wire';\nexport const error = new AgentError('BUSY', 'busy');\nexport const source: () => ToolSource = createWebMCPSource;\nexport const model = openAICompatible;\nexport const assistant = createAssistant;\n",
    );
    writeFileSync(
      path.join(consumer, 'tsconfig.json'),
      `${JSON.stringify({ compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, types: [] }, include: ['check.ts'] })}\n`,
    );
    execFileSync(path.join(root, 'node_modules/typescript/bin/tsc'), ['-p', 'tsconfig.json'], {
      cwd: consumer,
    });
  } finally {
    rmSync(packs, { recursive: true, force: true });
    rmSync(consumer, { recursive: true, force: true });
  }
}, 120_000);

function jsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(file);
    return entry.name.endsWith('.js') ? [file] : [];
  });
}

function readPkg(file: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return typeof value === 'object' && value !== null ? { ...value } : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? { ...value } : {};
}
