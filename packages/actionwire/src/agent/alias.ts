const MAX_ALIAS = 64;
const UNSAFE = /[^a-zA-Z0-9_-]/g;
const EDGE_UNDERSCORE = /^_+|_+$/g;

export type AliasTable = {
  aliasFor(tool: { id: string; name: string }): string;
  aliasOf(toolId: string): string;
  toolIdFor(alias: string): string | undefined;
};

export function createAliasTable(): AliasTable {
  const byToolId = new Map<string, string>();
  const byAlias = new Map<string, string>();

  function assign(toolId: string, name: string): string {
    const held = byToolId.get(toolId);
    if (held !== undefined) return held;
    const base = name.replace(UNSAFE, '_').replace(EDGE_UNDERSCORE, '').slice(0, MAX_ALIAS);
    let alias = base === '' ? 'tool' : base;
    let counter = 2;
    while (byAlias.has(alias)) {
      const suffix = `_${counter}`;
      alias = (base === '' ? 'tool' : base).slice(0, MAX_ALIAS - suffix.length) + suffix;
      counter += 1;
    }
    byToolId.set(toolId, alias);
    byAlias.set(alias, toolId);
    return alias;
  }

  return {
    aliasFor: (tool) => assign(tool.id, tool.name),
    aliasOf: (toolId) => assign(toolId, toolId),
    toolIdFor: (alias) => byAlias.get(alias),
  };
}
