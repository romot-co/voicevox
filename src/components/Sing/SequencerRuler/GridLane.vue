<template>
  <div class="sequencer-ruler-grid-lane">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="24"
      shape-rendering="crispEdges"
    >
      <defs>
        <pattern
          v-for="(gridPattern, patternIndex) in gridPatterns"
          :id="`sequencer-ruler-measure-${patternIndex}`"
          :key="`pattern-${patternIndex}`"
          patternUnits="userSpaceOnUse"
          :x="-offset + gridPattern.x"
          :width="gridPattern.patternWidth"
          :height="24"
        >
          <!-- 拍線（小節の最初を除く） -->
          <line
            v-for="n in gridPattern.beatsPerMeasure"
            :key="n"
            :x1="gridPattern.beatWidth * n"
            :x2="gridPattern.beatWidth * n"
            y1="0"
            :y2="24"
            class="sequencer-ruler-beat-line"
          />
        </pattern>
      </defs>
      <rect
        v-for="(gridPattern, index) in gridPatterns"
        :key="`grid-${index}`"
        :x="0.5 + gridPattern.x - offset"
        y="0"
        :height="24"
        :width="gridPattern.width"
        :fill="`url(#sequencer-ruler-measure-${index})`"
      />
      <!-- 小節線 -->
      <line
        v-for="measureInfo in measureInfos"
        :key="measureInfo.number"
        :x1="measureInfo.x - offset"
        :x2="measureInfo.x - offset"
        y1="0"
        :y2="24"
        class="sequencer-ruler-measure-line"
        :class="{ 'first-measure-line': measureInfo.number === 1 }"
      />
      <!-- 小節番号 -->
      <text
        v-for="measureInfo in measureInfos"
        :key="measureInfo.number"
        font-size="12"
        :x="measureInfo.x - offset + 4"
        y="16"
        class="sequencer-ruler-measure-number"
      >
        {{ measureInfo.number }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  width: number;
  offset: number;
  gridPatterns: {
    x: number;
    width: number;
    patternWidth: number;
    beatWidth: number;
    beatsPerMeasure: number;
  }[];
  measureInfos: {
    number: number;
    x: number;
  }[];
}>();
</script>

<style scoped lang="scss">
.sequencer-ruler-grid-lane {
  height: 24px;
  position: relative;
  overflow: hidden;
  pointer-events: none;
  background: transparent;
  z-index: 1;
}

.sequencer-ruler-measure-number {
  font-weight: 700;
  fill: var(--scheme-color-on-surface-variant);
}

.sequencer-ruler-measure-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-ruler-measure-line);
  stroke-width: 1px;

  &.first-measure-line {
    stroke: var(--scheme-color-sing-ruler-surface);
  }
}

.sequencer-ruler-beat-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-sing-ruler-beat-line);
  stroke-width: 1px;
}
</style>
