<script setup lang="ts">
  import { computed, provide, ref, useSlots, type VNode } from 'vue';

  import { icon } from '../../icons';
  import { TABS } from '../tabs';

  interface TabProps {
    label?: string;
    icon?: string;
  }

  const slots = useSlots();

  /**
   * Read the tabs from the slot vnodes, not from the children themselves. A
   * child registers during its own setup, which runs after this template asks
   * for the list, so registration renders an empty strip on the server.
   */
  function walk(nodes: VNode[], found: TabProps[] = []): TabProps[] {
    for (const node of nodes) {
      if (Array.isArray(node.children)) walk(node.children as VNode[], found);
      const props = node.props as TabProps | null;
      if (props?.label) found.push(props);
    }
    return found;
  }

  const tabs = computed(() => walk(slots.default?.() ?? []));
  const labels = computed(() => tabs.value.map((tab) => tab.label ?? ''));
  const active = ref(0);

  provide(TABS, { labels, active });

  function onKeydown(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + labels.value.length) % labels.value.length;
    active.value = next;
    const list = (event.currentTarget as HTMLElement).parentElement;
    (list?.children[next] as HTMLElement | undefined)?.focus();
  }
</script>

<template>
  <div class="aw-tabs">
    <div
      class="aw-tabs-list"
      role="tablist"
    >
      <button
        v-for="(tab, index) in tabs"
        :key="tab.label"
        class="aw-tabs-tab"
        :class="{ 'aw-tabs-tab-active': index === active }"
        type="button"
        role="tab"
        :aria-selected="index === active"
        :tabindex="index === active ? 0 : -1"
        @click="active = index"
        @keydown="onKeydown($event, index)"
      >
        <span
          v-if="tab.icon"
          class="aw-tabs-glyph"
          v-html="icon(tab.icon)"
        />
        {{ tab.label }}
      </button>
    </div>
    <slot />
  </div>
</template>
