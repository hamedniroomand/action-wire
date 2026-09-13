import type { ComputedRef, InjectionKey, Ref } from 'vue';

export interface TabsApi {
  /**
   * Tab labels in document order.
   *
   * ponytail: a tab finds itself by the index of its label, so two tabs with
   * the same label in one group both stay open and nothing reports it. Give
   * each `Tab` a unique label. To lift the ceiling, pass an explicit index
   * from `Tabs` to each child instead of matching on the label.
   */
  labels: ComputedRef<string[]>;
  active: Ref<number>;
}

export const TABS: InjectionKey<TabsApi> = Symbol('aw-tabs');
