import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['core', 'webmcp', 'agent', 'widget'] as const;

it('packs installable ESM packages without workspace aliases', () => {
  execFileSync(
    'pnpm',
    [
      '--filter',
      './packages/core',
      '--filter',
      './packages/webmcp',
      '--filter',
      './packages/agent',
      '--filter',
      './packages/widget',
      'build',
    ],
    { cwd: root },
  );

  for (const name of PACKAGES) {
    for (const file of jsFiles(path.join(root, 'packages', name, 'dist'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"]~\//);
    }
    const pkg = readPkg(path.join(root, 'packages', name, 'package.json'));
    expect(pkg['files']).toEqual(['dist']);
    expect(pkg['type']).toBe('module');
    const dependencies = {
      ...asRecord(pkg['dependencies']),
      ...asRecord(pkg['devDependencies']),
      ...asRecord(pkg['peerDependencies']),
    };
    for (const banned of [
      'react',
      'vue',
      'svelte',
      'livekit-client',
      'openai-realtime',
      'webrtc',
    ]) {
      expect(dependencies[banned], `${name} must not depend on ${banned}`).toBeUndefined();
    }
  }

  const packs = mkdtempSync(path.join(tmpdir(), 'webmcp-pack-'));
  const consumer = mkdtempSync(path.join(tmpdir(), 'webmcp-consumer-'));
  try {
    for (const name of PACKAGES) {
      execFileSync('pnpm', ['pack', '--pack-destination', packs], {
        cwd: path.join(root, 'packages', name),
      });
    }
    const tarballs = readdirSync(packs).filter((name) => name.endsWith('.tgz'));
    expect(tarballs).toHaveLength(4);
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
    expect(
      JSON.stringify(readPkg(path.join(consumer, 'node_modules/@action-wire/agent/package.json'))),
    ).not.toContain('workspace:');

    const result = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import { createToolRegistry } from '@action-wire/core'; import { createAgentBridge } from '@action-wire/agent'; import { createAssistant } from 'action-wire'; import { createWebMCPSource } from '@action-wire/webmcp'; createToolRegistry(); console.log([typeof createAgentBridge, typeof createAssistant, typeof createWebMCPSource].join(' '));",
      ],
      { cwd: consumer, encoding: 'utf8' },
    );
    expect(result.trim()).toBe('function function function');

    writeFileSync(
      path.join(consumer, 'check.ts'),
      "import { createAssistant } from 'action-wire';\nimport { openAICompatible } from '@action-wire/agent';\nimport { createToolRegistry } from '@action-wire/core';\nimport { createWebMCPSource } from '@action-wire/webmcp';\nexport const registry = createToolRegistry();\nexport const source = createWebMCPSource;\nexport const model = openAICompatible;\nexport const assistant = createAssistant;\n",
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
