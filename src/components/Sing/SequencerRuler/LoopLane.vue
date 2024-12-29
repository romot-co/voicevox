<template>
  <div
    class="sequencer-ruler-loop-lane"
    :class="{
      'is-enabled': isLoopEnabled,
      'is-dragging': isDragging,
      'is-empty': isEmpty,
    }"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="40"
      shape-rendering="crispEdges"
    >
      <!-- ループエリア -->
      <rect
        x="0"
        y="0"
        :width
        height="40"
        rx="6"
        ry="6"
        class="loop-background"
        @mousedown.stop="onLoopAreaMouseDown"
        @mouseup.stop
      />
      <!-- ループ範囲 -->
      <rect
        v-if="!isEmpty"
        :x="loopStartX - offset + 4"
        y="4"
        :width="Math.max(loopEndX - loopStartX - 8, 0)"
        height="32"
        rx="2"
        ry="2"
        class="loop-range"
        @click.stop="onLoopRangeClick"
      />
      <!-- ループ開始ハンドル -->
      <g class="loop-handle-group">
        <rect
          :x="loopStartX - offset"
          y="0"
          width="2"
          height="40"
          rx="1"
          ry="1"
          class="loop-handle loop-handle-start"
          :class="{ 'is-empty': isEmpty }"
          @mousedown.stop="onStartHandleMouseDown"
        />
        <rect
          :x="loopStartX - offset - 2"
          y="0"
          width="8"
          height="40"
          class="loop-handle-drag-area"
          @mousedown.stop="onStartHandleMouseDown"
        />
      </g>
      <!-- ループ終了ハンドル -->
      <g class="loop-handle-group">
        <rect
          :x="loopEndX - offset - 2"
          y="0"
          width="2"
          height="40"
          rx="1"
          ry="1"
          class="loop-handle loop-handle-end"
          :class="{ 'is-empty': isEmpty }"
          @mousedown.stop="onEndHandleMouseDown"
        />
        <rect
          :x="loopEndX - offset - 6"
          y="0"
          width="8"
          height="40"
          class="loop-handle-drag-area"
          @mousedown.stop="onEndHandleMouseDown"
        />
      </g>
      <!-- ループ範囲外を暗くする -->
      <g v-if="isLoopEnabled && !isEmpty">
        <!-- 左側 -->
        <rect
          x="0"
          y="0"
          :width="Math.max(0, loopStartX - offset)"
          height="40"
          class="sequencer-ruler-loop-mask"
          pointer-events="none"
        />
        <!-- 右側 -->
        <rect
          :x="Math.max(0, loopEndX - offset)"
          y="0"
          :width="Math.max(0, width - (loopEndX - offset))"
          height="40"
          class="sequencer-ruler-loop-mask"
          pointer-events="none"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useStore } from "@/store";
import { useLoopControl } from "@/composables/useLoopControl";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";

const props = defineProps<{
  width: number;
  offset: number;
}>();

const store = useStore();
const {
  isLoopEnabled,
  loopStartTick,
  loopEndTick,
  setLoopEnabled,
  setLoopRange,
  // clearLoopRange,
  snapToGrid,
} = useLoopControl();

const tpqn = computed(() => store.state.tpqn);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);

// ドラッグ中のループ範囲を保持
const previewLoopStartTick = ref(loopStartTick.value);
const previewLoopEndTick = ref(loopEndTick.value);

// 現在のループ範囲
const currentLoopStartTick = computed(() =>
  isDragging.value ? previewLoopStartTick.value : loopStartTick.value,
);
const currentLoopEndTick = computed(() =>
  isDragging.value ? previewLoopEndTick.value : loopEndTick.value,
);

// ループのX座標を計算
const loopStartX = computed(() =>
  Math.round(
    tickToBaseX(currentLoopStartTick.value, tpqn.value) * sequencerZoomX.value,
  ),
);
const loopEndX = computed(() =>
  Math.round(
    tickToBaseX(currentLoopEndTick.value, tpqn.value) * sequencerZoomX.value,
  ),
);

// ドラッグ関連の状態
const isDragging = ref(false);
const dragTarget = ref<"start" | "end" | null>(null);
const dragStartX = ref(0);
const dragStartHandleX = ref(0);
let lastMouseEvent: MouseEvent | null = null;

// ループが空かどうか
const isEmpty = computed(
  () => currentLoopStartTick.value === currentLoopEndTick.value,
);

// プレビュー関連
const executePreviewProcess = ref(false);
let previewRequestId: number | null = null;

const onLoopAreaMouseDown = (event: MouseEvent) => {
  if (event.button !== 0 || (event.ctrlKey && event.button === 0)) return;

  executePreviewProcess.value = false;
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const x = clickX + props.offset;
  const tick = snapToGrid(baseXToTick(x / sequencerZoomX.value, tpqn.value));

  previewLoopStartTick.value = tick;
  previewLoopEndTick.value = tick;
  void setLoopRange(tick, tick);
  void setLoopEnabled(true);
  startDragging("end", event);
};

const onLoopRangeClick = async () => {
  await setLoopEnabled(!isLoopEnabled.value);
};

const startDragging = (target: "start" | "end", event: MouseEvent) => {
  if (event.button !== 0) return;

  isDragging.value = true;
  dragTarget.value = target;
  dragStartX.value = event.clientX;
  dragStartHandleX.value =
    target === "start" ? loopStartX.value : loopEndX.value;

  previewLoopStartTick.value = loopStartTick.value;
  previewLoopEndTick.value = loopEndTick.value;

  lastMouseEvent = event;
  executePreviewProcess.value = true;
  if (previewRequestId == null) {
    previewRequestId = requestAnimationFrame(preview);
  }
  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseup", stopDragging, true);
};

const onMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return;
  lastMouseEvent = event;
  executePreviewProcess.value = true;
};

const preview = () => {
  if (executePreviewProcess.value && lastMouseEvent) {
    executePreviewProcess.value = false;
    const event = lastMouseEvent;
    const dx = event.clientX - dragStartX.value;
    const newX = dragStartHandleX.value + dx;
    const baseTick = baseXToTick(newX / sequencerZoomX.value, tpqn.value);
    const newTick = Math.max(0, snapToGrid(baseTick));

    try {
      if (dragTarget.value === "start") {
        if (newTick <= previewLoopEndTick.value) {
          previewLoopStartTick.value = newTick;
        } else {
          // 開始ハンドルが終了ハンドルを超えた場合、開始と終了を入れ替える
          previewLoopStartTick.value = previewLoopEndTick.value;
          previewLoopEndTick.value = newTick;
          dragTarget.value = "end";
          dragStartX.value = event.clientX;
          dragStartHandleX.value = newX;
        }
      } else if (dragTarget.value === "end") {
        if (newTick >= previewLoopStartTick.value) {
          previewLoopEndTick.value = newTick;
        } else {
          // 終了ハンドルが開始ハンドルを下回った場合、開始と終了を入れ替える
          previewLoopEndTick.value = previewLoopStartTick.value;
          previewLoopStartTick.value = newTick;
          dragTarget.value = "start";
          dragStartX.value = event.clientX;
          dragStartHandleX.value = newX;
        }
      }
    } catch (error) {
      throw new Error("Failed to update loop range", { cause: error });
    }
  }

  if (isDragging.value) {
    previewRequestId = requestAnimationFrame(preview);
  } else {
    previewRequestId = null;
  }
};

const stopDragging = () => {
  if (!isDragging.value) return;

  isDragging.value = false;
  dragTarget.value = null;
  executePreviewProcess.value = false;
  window.removeEventListener("mousemove", onMouseMove, true);
  window.removeEventListener("mouseup", stopDragging, true);

  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }

  try {
    // ループ範囲を設定
    void setLoopRange(previewLoopStartTick.value, previewLoopEndTick.value);
    // プレイヘッドをループ開始位置に移動
    try {
      void store.dispatch("SET_PLAYHEAD_POSITION", {
        position: previewLoopStartTick.value,
      });
    } catch (error) {
      throw new Error("Failed to move playhead", { cause: error });
    }
  } catch (error) {
    throw new Error("Failed to set loop range", { cause: error });
  }
};

const onStartHandleMouseDown = (event: MouseEvent) => {
  startDragging("start", event);
};

const onEndHandleMouseDown = (event: MouseEvent) => {
  startDragging("end", event);
};

onUnmounted(() => {
  window.removeEventListener("mousemove", onMouseMove, true);
  window.removeEventListener("mouseup", stopDragging, true);
  if (previewRequestId != null) {
    cancelAnimationFrame(previewRequestId);
    previewRequestId = null;
  }
});
</script>

<style scoped lang="scss">
.sequencer-ruler-loop-lane {
  height: 40px;
  position: relative;
  overflow: hidden;
  pointer-events: auto;
  cursor: pointer;
  width: 100%;
  z-index: 1;

  &.is-enabled {
    .loop-range {
      fill: color-mix(
        in oklch,
        var(--scheme-color-primary-fixed-dim) 40%,
        var(--scheme-color-sing-loop-area)
      );
    }

    .loop-handle {
      fill: var(--scheme-color-primary-fixed-dim);
      stroke: var(--scheme-color-primary-fixed-dim);
    }
  }

  &:not(.is-enabled) {
    .loop-range {
      fill: var(--scheme-color-outline);
      opacity: 0.6;
    }

    .loop-handle {
      fill: var(--scheme-color-outline);
      stroke: var(--scheme-color-outline);
      opacity: 0.6;
    }
  }

  &.is-dragging {
    .loop-background {
      background: var(--scheme-color-secondary-container);
      opacity: 0.4;
    }

    .loop-range {
      opacity: 0.6;
    }

    .loop-handle {
      fill: var(--scheme-color-primary-fixed);
      stroke: var(--scheme-color-primary-fixed);
    }
  }

  &.is-empty:not(.is-dragging) {
    .loop-range,
    .loop-handle,
    .loop-drag-area {
      display: none;
    }
  }

  &.is-dragging.is-empty {
    .loop-handle {
      fill: var(--scheme-color-outline);
      stroke: var(--scheme-color-outline);
      opacity: 0.38;
    }
  }

  &:not(.is-dragging) {
    .loop-handle {
      &:hover,
      &-start:hover,
      &-end:hover {
        fill: var(--scheme-color-primary-fixed);
        outline: 2px solid
          oklch(from var(--scheme-color-primary-fixed) l c h / 0.5);
        outline-offset: 1px;
      }
    }
  }
}

.loop-background {
  fill: transparent;
  transition: fill 0.1s ease-out;

  &:hover {
    fill: var(--scheme-color-sing-loop-area);
  }
}

.loop-range {
  fill: var(--scheme-color-outline);
  pointer-events: auto;
  cursor: pointer;

  &-area {
    fill: transparent;
  }
}

.loop-handle {
  fill: var(--scheme-color-outline);
  cursor: ew-resize;
  pointer-events: auto;

  &.is-empty {
    fill: var(--scheme-color-outline);
  }
}

.loop-handle-group:hover {
  .loop-handle {
    fill: var(--scheme-color-primary-fixed);
  }
}

.loop-handle-drag-area {
  fill: transparent;
  cursor: ew-resize;
  pointer-events: auto;
}

.sequencer-ruler-loop-mask {
  fill: var(--scheme-color-scrim);
  pointer-events: none;
}

:root[is-dark-theme="false"] .sequencer-ruler-loop-mask {
  opacity: 0.08;
}

:root[is-dark-theme="true"] .sequencer-ruler-loop-mask {
  opacity: 0.24;
}
</style>
