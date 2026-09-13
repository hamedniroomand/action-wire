<script setup lang="ts">
  import { useData } from 'vitepress';
  import { onMounted, ref, watch } from 'vue';

  const props = defineProps<{ code: string }>();

  const { isDark } = useData();
  const host = ref<HTMLElement>();
  const id = `aw-mermaid-${Math.random().toString(36).slice(2)}`;

  // Mermaid is browser only and large. Load it on the first diagram, not in the
  // page bundle, and redraw when the reader switches the color scheme.
  async function draw(): Promise<void> {
    if (!host.value) return;
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDark.value ? 'dark' : 'default',
    });
    const { svg } = await mermaid.render(id, decodeURIComponent(props.code));
    host.value.innerHTML = svg;
  }

  onMounted(draw);
  watch(isDark, draw);
</script>

<template>
  <div
    ref="host"
    class="aw-mermaid"
  />
</template>
