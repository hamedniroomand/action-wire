<script setup lang="ts">
  import { computed, inject } from 'vue';

  import { TABS } from '../tabs';

  const props = defineProps<{ label: string; icon?: string }>();

  const tabs = inject(TABS, undefined);
  const shown = computed(
    () => !tabs || tabs.labels.value.indexOf(props.label) === tabs.active.value,
  );
</script>

<template>
  <div
    v-show="shown"
    class="aw-tab"
    role="tabpanel"
  >
    <slot />
  </div>
</template>
