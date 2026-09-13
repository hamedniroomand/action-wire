<script setup lang="ts">
  const props = defineProps<{ cols?: number | string }>();
</script>

<template>
  <div
    class="aw-card-group"
    :style="{ '--aw-cols': String(props.cols ?? 2) }"
  >
    <slot />
  </div>
</template>
