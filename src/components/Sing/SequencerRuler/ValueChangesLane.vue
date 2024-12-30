<template>
  <div class="sequencer-ruler-value-changes-lane">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="24"
      shape-rendering="crispEdges"
    >
      <!-- テンポ・拍子表示 -->
      <template v-for="valueChange in valueChanges" :key="valueChange.position">
        <text
          font-size="12"
          :x="valueChange.x - offset + valueChangeTextPadding"
          y="16"
          class="sequencer-ruler-value-change"
          @click.stop="onValueChangeClick($event, valueChange)"
          @contextmenu.stop="onValueChangeClick($event, valueChange)"
        >
          {{ valueChange.displayText }}
        </text>
        <line
          :x1="valueChange.x - offset"
          :x2="valueChange.x - offset"
          y1="0"
          :y2="24"
          class="sequencer-ruler-value-change-line"
        />
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
type ValueChange = {
  position: number;
  x: number;
  displayText: string;
};

defineProps<{
  width: number;
  offset: number;
  valueChanges: ValueChange[];
  valueChangeTextPadding: number;
}>();

const emit = defineEmits<{
  (e: "valueChangeClick", event: MouseEvent, valueChange: ValueChange): void;
}>();

const onValueChangeClick = (event: MouseEvent, valueChange: ValueChange) => {
  emit("valueChangeClick", event, valueChange);
};
</script>

<style scoped lang="scss">
.sequencer-ruler-value-changes-lane {
  height: 24px;
  position: relative;
  overflow: hidden;
  background: var(--scheme-color-sing-ruler-surface);
  width: 100%;
  z-index: 1;
}

.sequencer-ruler-value-change {
  font-weight: 700;
  fill: var(--scheme-color-on-surface-variant);

  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

.sequencer-ruler-value-change-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-on-surface-variant);
  stroke-width: 1px;
}
</style>
