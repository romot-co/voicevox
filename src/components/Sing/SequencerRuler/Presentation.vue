<template>
  <div
    ref="sequencerRuler"
    class="sequencer-ruler"
    @click="onClick"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="sequencer-ruler-content" :style="{ width: `${props.width}px` }">
      <div class="sequencer-ruler-grid">
        <!-- NOTE: slotを使う(Copilotくんが提案してくれた) -->
        <slot name="grid" />
      </div>
      <div class="sequencer-ruler-value-changes">
        <slot name="changes" />
      </div>
      <div class="sequencer-ruler-loop">
        <slot name="loop" />
      </div>
      <!-- ホバー時のプレイヘッド（薄い色で表示） -->
      <div
        v-if="props.hoverPlayheadX !== null"
        class="sequencer-ruler-hover-playhead"
        :style="{
          transform: `translateX(${props.hoverPlayheadX - props.offset}px)`,
        }"
      />
      <div
        class="sequencer-ruler-playhead"
        :style="{
          transform: `translateX(${props.playheadX - props.offset}px)`,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
defineOptions({
  name: "RulerPresentation",
});

const props = defineProps<{
  width: number;
  playheadX: number;
  offset: number;
  hoverPlayheadX: number | null;
}>();

const emit = defineEmits<{
  click: [MouseEvent];
  mousemove: [MouseEvent];
  mouseleave: [MouseEvent];
}>();

const sequencerRuler = ref<HTMLDivElement | null>(null);

const onClick = (event: MouseEvent) => {
  emit("click", event);
};

const onMouseMove = (event: MouseEvent) => {
  console.log("Ruler mousemove", event.offsetX);
  emit("mousemove", event);
};

const onMouseLeave = (event: MouseEvent) => {
  console.log("Ruler mouseleave");
  emit("mouseleave", event);
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.sequencer-ruler {
  background: var(--scheme-color-sing-ruler-surface);
  height: 40px;
  position: relative;
  overflow: hidden;
  z-index: vars.$z-index-sing-ruler;
  isolation: isolate; // ルーラー内で重なりを局所管理
}

.sequencer-ruler-content {
  position: relative;
  width: 100%;
  height: 100%;
  &:hover {
    cursor: pointer;
  }
}

.lane-background:hover {
  fill: var(--scheme-color-sing-ruler-surface-hover);
}

.sequencer-ruler-loop {
  position: absolute;
  z-index: 0; // ルーラー内においてグリッドより下
}

.sequencer-ruler-grid {
  position: absolute;
  z-index: 1; // ルーラー内でグリッド線が重なりの影響を受けないようにするため一番上に
  pointer-events: none; // クリック無効
}

.sequencer-ruler-value-changes {
  position: absolute;
  z-index: 2; // ルーラー内においてグリッドより上
}

.sequencer-ruler-playhead {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 100%;
  background: var(--scheme-color-inverse-surface);
  pointer-events: none;
  will-change: transform;
  z-index: vars.$z-index-sing-playhead;
}

.sequencer-ruler-hover-playhead {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 100%;
  background: var(--scheme-color-inverse-surface);
  opacity: 0.25;
  pointer-events: none;
  will-change: transform;
  z-index: 5; // 実際のplayheadより下に表示
}
</style>
