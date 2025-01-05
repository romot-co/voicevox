<template>
  <div
    ref="sequencerRuler"
    class="sequencer-ruler"
    @click="handleClick"
    @contextmenu="handleContextMenu"
  >
    <div class="sequencer-ruler-lanes">
      <div class="sequencer-ruler-upper-lanes">
        <GridLane :width :offset :gridPatterns :measureInfos />
        <LoopLane :width :offset />
      </div>
      <ValueChangesLane
        :width
        :offset
        :tpqn
        :tempos
        :timeSignatures
        :sequencerZoomX
        :uiLocked
        :playheadTicks
        :currentMeasure
        @valueChangeClick="handleValueChangeClick"
        @editTempo="handleEditTempo"
        @removeTempo="handleRemoveTempo"
        @editTimeSignature="handleEditTimeSignature"
        @removeTimeSignature="handleRemoveTimeSignature"
      />
    </div>
    <!-- 再生ヘッド -->
    <div
      class="sequencer-ruler-playhead"
      :style="{
        transform: `translateX(${playheadX - offset}px)`,
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, useTemplateRef } from "vue";
import { Dialog } from "quasar";
import GridLane from "./GridLane.vue";
import LoopLane from "./LoopLane.vue";
import ValueChangesLane from "./ValueChangesLane.vue";
import {
  getMeasureDuration,
  getTimeSignaturePositions,
  snapTicksToGrid,
  tickToMeasureNumber,
} from "@/sing/domain";
import { baseXToTick, tickToBaseX } from "@/sing/viewHelper";
import { Tempo, TimeSignature } from "@/store/type";
import TempoChangeDialog from "@/components/Sing/ChangeValueDialog/TempoChangeDialog.vue";
import TimeSignatureChangeDialog from "@/components/Sing/ChangeValueDialog/TimeSignatureChangeDialog.vue";
import { useSequencerGrid } from "@/composables/useSequencerGridPattern";
import { UnreachableError } from "@/type/utility";

const props = defineProps<{
  offset: number;
  numMeasures: number;
  tpqn: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  sequencerZoomX: number;
  uiLocked: boolean;
  sequencerSnapType: number;
}>();

const playheadTicks = defineModel<number>("playheadTicks", {
  required: true,
});

const emit = defineEmits<{
  deselectAllNotes: [];
  setTempo: [tempo: Tempo];
  removeTempo: [position: number];
  setTimeSignature: [timeSignature: TimeSignature];
  removeTimeSignature: [measureNumber: number];
}>();

// レイアウト制御
const height = ref(48);
const width = computed(() => {
  return tickToBaseX(endTicks.value, props.tpqn) * props.sequencerZoomX;
});

// 時間位置の計算
const tsPositions = computed(() => {
  return getTimeSignaturePositions(props.timeSignatures, props.tpqn);
});

// シーケンサーの終端位置
const endTicks = computed(() => {
  const lastTs = props.timeSignatures[props.timeSignatures.length - 1];
  if (!lastTs) {
    throw new UnreachableError("少なくとも1つの拍子記号が必要です");
  }
  const lastTsPosition = tsPositions.value[tsPositions.value.length - 1];
  return (
    lastTsPosition +
    getMeasureDuration(lastTs.beats, lastTs.beatType, props.tpqn) *
      (props.numMeasures - lastTs.measureNumber + 1)
  );
});

// グリッドパターン
const gridPatterns = useSequencerGrid({
  timeSignatures: computed(() => props.timeSignatures),
  tpqn: computed(() => props.tpqn),
  sequencerZoomX: computed(() => props.sequencerZoomX),
  numMeasures: computed(() => props.numMeasures),
});

// 小節情報の計算
const measureInfos = computed(() => {
  return props.timeSignatures.flatMap((timeSignature, i) => {
    const measureDuration = getMeasureDuration(
      timeSignature.beats,
      timeSignature.beatType,
      props.tpqn,
    );
    const nextTsPosition =
      i !== props.timeSignatures.length - 1
        ? tsPositions.value[i + 1]
        : endTicks.value;
    const start = tsPositions.value[i];
    const end = nextTsPosition;
    const numMeasures = Math.floor((end - start) / measureDuration);
    return Array.from({ length: numMeasures }, (_, index) => {
      const measureNumber = timeSignature.measureNumber + index;
      const measurePosition = start + index * measureDuration;
      const baseX = tickToBaseX(measurePosition, props.tpqn);
      return {
        number: measureNumber,
        x: Math.round(baseX * props.sequencerZoomX),
      };
    });
  });
});

// 再生ヘッドの位置
const playheadX = computed(() => {
  const baseX = tickToBaseX(playheadTicks.value, props.tpqn);
  return Math.floor(baseX * props.sequencerZoomX);
});

// スナップタイプに応じたtick
const snapTicks = computed(() => {
  return getMeasureDuration(1, props.sequencerSnapType, props.tpqn);
});

// クリック位置からスナップされたtickを取得
const getSnappedTickFromOffsetX = (offsetX: number) => {
  const baseX = (props.offset + offsetX) / props.sequencerZoomX;
  return snapTicksToGrid(baseXToTick(baseX, props.tpqn), snapTicks.value);
};

// イベントハンドラ
const handleClick = (event: MouseEvent) => {
  emit("deselectAllNotes");

  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new UnreachableError("シーケンサールーラー要素が存在しません");
  }
  const ticks = getSnappedTickFromOffsetX(event.offsetX);
  playheadTicks.value = ticks;
};

// リサイズ処理
const sequencerRuler = useTemplateRef<HTMLDivElement>("sequencerRuler");
let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new UnreachableError("シーケンサールーラー要素が存在しません");
  }
  resizeObserver = new ResizeObserver((entries) => {
    let blockSize = 0;
    for (const entry of entries) {
      for (const borderBoxSize of entry.borderBoxSize) {
        blockSize = borderBoxSize.blockSize;
      }
    }
    if (blockSize > 0 && blockSize !== height.value) {
      height.value = blockSize;
    }
  });
  resizeObserver.observe(sequencerRulerElement);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

// 再生ヘッドの位置
const currentMeasure = computed(() =>
  tickToMeasureNumber(playheadTicks.value, props.timeSignatures, props.tpqn),
);

// TODO: 以下の責務をValueChangesLaneに移動

// 再生ヘッドの位置にあるテンポ
const currentTempo = computed(() => {
  const maybeTempo = props.tempos.findLast((tempo) => {
    return tempo.position <= playheadTicks.value;
  });
  if (!maybeTempo) {
    throw new UnreachableError("assert: At least one tempo exists.");
  }
  return maybeTempo;
});

// 再生ヘッドの位置にある拍子記号
const currentTimeSignature = computed(() => {
  const maybeTimeSignature = props.timeSignatures.findLast((timeSignature) => {
    return timeSignature.measureNumber <= currentMeasure.value;
  });
  if (!maybeTimeSignature) {
    throw new UnreachableError("assert: At least one time signature exists.");
  }
  return maybeTimeSignature;
});

// 再生ヘッドの位置にあるテンポが存在するか
const tempoChangeExists = computed(
  () => currentTempo.value.position === playheadTicks.value,
);

// 再生ヘッドの位置にある拍子記号が存在するか
const timeSignatureChangeExists = computed(
  () => currentTimeSignature.value.measureNumber === currentMeasure.value,
);

const handleValueChangeClick = (
  event: MouseEvent,
  valueChange: { position: number },
) => {
  playheadTicks.value = valueChange.position;
};

const handleEditTempo = () => {
  Dialog.create({
    component: TempoChangeDialog,
    componentProps: {
      tempoChange: currentTempo.value,
      mode: tempoChangeExists.value ? "edit" : "add",
    },
  }).onOk((result: { tempoChange: Omit<Tempo, "position"> }) => {
    emit("setTempo", {
      ...result.tempoChange,
      position: playheadTicks.value,
    });
  });
};

const handleRemoveTempo = () => {
  emit("removeTempo", playheadTicks.value);
};

const handleEditTimeSignature = () => {
  Dialog.create({
    component: TimeSignatureChangeDialog,
    componentProps: {
      timeSignatureChange: currentTimeSignature.value,
      mode: timeSignatureChangeExists.value ? "edit" : "add",
    },
  }).onOk(
    (result: { timeSignatureChange: Omit<TimeSignature, "position"> }) => {
      emit("setTimeSignature", {
        ...result.timeSignatureChange,
        measureNumber: currentMeasure.value,
      });
    },
  );
};

const handleRemoveTimeSignature = () => {
  emit("removeTimeSignature", currentMeasure.value);
};

const handleContextMenu = (event: MouseEvent) => {
  emit("deselectAllNotes");
  const ticks = getSnappedTickFromOffsetX(event.offsetX);
  playheadTicks.value = ticks;
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.sequencer-ruler {
  background: var(--scheme-color-sing-ruler-surface);
  height: 48px;
  position: relative;
  overflow: hidden;
}

.sequencer-ruler-lanes {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.sequencer-ruler-upper-lanes {
  position: relative;
  height: 24px;
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
  z-index: vars.$z-index-sing-ruler-playhead;
}
</style>
