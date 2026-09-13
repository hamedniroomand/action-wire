<script setup lang="ts">
  import { withBase } from 'vitepress';

  import { icon } from '../../icons';

  defineProps<{ to: string; title: string }>();

  const arrow = icon('arrow-right');
</script>

<template>
  <a
    class="aw-read-more"
    :href="withBase(to)"
  >
    <span class="aw-read-more-label">Read more</span>
    <span class="aw-read-more-title">{{ title }}</span>
    <span
      class="aw-read-more-arrow"
      v-html="arrow"
    />
  </a>
</template>
