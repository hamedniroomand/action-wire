<script setup lang="ts">
  import { withBase } from 'vitepress';
  import { computed } from 'vue';

  import { icon } from '../../icons';

  const props = defineProps<{ title?: string; icon?: string; to?: string }>();

  const glyph = computed(() => (props.icon ? icon(props.icon) : ''));
  const arrow = icon('arrow-right');
</script>

<template>
  <component
    :is="to ? 'a' : 'div'"
    class="aw-card"
    :class="{ 'aw-card-link': to }"
    :href="to ? withBase(to) : undefined"
  >
    <span
      v-if="glyph"
      class="aw-card-glyph"
      v-html="glyph"
    />
    <p
      v-if="title"
      class="aw-card-title"
    >
      {{ title }}
    </p>
    <div class="aw-card-body">
      <slot />
    </div>
    <span
      v-if="to"
      class="aw-card-arrow"
      v-html="arrow"
    />
  </component>
</template>
