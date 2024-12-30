<template>
  <div
    ref="sequencerRuler"
    class="sequencer-ruler"
    @click="onClick"
    @contextmenu="onContextMenu"
  >
    <ContextMenu
      ref="contextMenu"
      :header="contextMenuHeader"
      :menudata="contextMenuData"
      :uiLocked
    />
    <div class="sequencer-ruler-lanes">
      <div class="sequencer-ruler-upper-lanes">
        <GridLane :width :offset :gridPatterns :measureInfos />
        <LoopLane :width :offset />
      </div>
      <ValueChangesLane
        :width
        :offset
        :valueChanges
        :valueChangeTextPadding
        @valueChangeClick="onValueChangeClick"
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
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
  ComponentPublicInstance,
  useTemplateRef,
} from "vue";
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
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Presentation.vue";
import TempoChangeDialog from "@/components/Sing/ChangeValueDialog/TempoChangeDialog.vue";
import TimeSignatureChangeDialog from "@/components/Sing/ChangeValueDialog/TimeSignatureChangeDialog.vue";
import { createLogger } from "@/domain/frontend/log";
import { useSequencerGrid } from "@/composables/useSequencerGridPattern";

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

const log = createLogger("SequencerRuler");

const height = ref(48);
const width = computed(() => {
  return tickToBaseX(endTicks.value, props.tpqn) * props.sequencerZoomX;
});

const tsPositions = computed(() => {
  return getTimeSignaturePositions(props.timeSignatures, props.tpqn);
});

const endTicks = computed(() => {
  const lastTs = props.timeSignatures[props.timeSignatures.length - 1];
  const lastTsPosition = tsPositions.value[tsPositions.value.length - 1];
  return (
    lastTsPosition +
    getMeasureDuration(lastTs.beats, lastTs.beatType, props.tpqn) *
      (props.numMeasures - lastTs.measureNumber + 1)
  );
});

const gridPatterns = useSequencerGrid({
  timeSignatures: computed(() => props.timeSignatures),
  tpqn: computed(() => props.tpqn),
  sequencerZoomX: computed(() => props.sequencerZoomX),
  numMeasures: computed(() => props.numMeasures),
});

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

const playheadX = computed(() => {
  const baseX = tickToBaseX(playheadTicks.value, props.tpqn);
  return Math.floor(baseX * props.sequencerZoomX);
});

const snapTicks = computed(() => {
  return getMeasureDuration(1, props.sequencerSnapType, props.tpqn);
});

const getSnappedTickFromOffsetX = (offsetX: number) => {
  const baseX = (props.offset + offsetX) / props.sequencerZoomX;
  return snapTicksToGrid(baseXToTick(baseX, props.tpqn), snapTicks.value);
};

const onClick = (event: MouseEvent) => {
  emit("deselectAllNotes");

  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new Error("sequencerRulerElement is null.");
  }
  const ticks = getSnappedTickFromOffsetX(event.offsetX);
  playheadTicks.value = ticks;
};

const sequencerRuler = useTemplateRef<HTMLDivElement>("sequencerRuler");
let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  const sequencerRulerElement = sequencerRuler.value;
  if (!sequencerRulerElement) {
    throw new Error("sequencerRulerElement is null.");
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

const contextMenu = ref<ComponentPublicInstance<typeof ContextMenu> | null>(
  null,
);

const onContextMenu = async (event: MouseEvent) => {
  emit("deselectAllNotes");

  const snappedTicks = getSnappedTickFromOffsetX(event.offsetX);
  playheadTicks.value = snappedTicks;
  contextMenu.value?.show(event);
};

const valueChangeTextPadding = 4;

const valueChanges = computed(() => {
  const timeSignaturesWithTicks = tsPositions.value.map((tsPosition, i) => ({
    type: "timeSignature" as const,
    position: tsPosition,
    timeSignature: props.timeSignatures[i],
  }));
  const tempos = props.tempos.map((tempo) => {
    return {
      type: "tempo" as const,
      position: tempo.position,
      tempo,
    };
  });

  return [
    ...Map.groupBy(
      [...tempos, ...timeSignaturesWithTicks],
      (item) => item.position,
    ).entries(),
  ]
    .toSorted((a, b) => a[0] - b[0])
    .map(([tick, items]) => {
      const tempo = items.find((item) => item.type === "tempo")?.tempo;
      const timeSignature = items.find(
        (item) => item.type === "timeSignature",
      )?.timeSignature;

      const tempoText = tempo?.bpm ?? "";
      const timeSignatureText = timeSignature
        ? `${timeSignature.beats}/${timeSignature.beatType}`
        : "";

      const text = [tempoText, timeSignatureText].join(" ");

      return {
        position: tick,
        x: tickToBaseX(tick, props.tpqn) * props.sequencerZoomX,
        displayText: text,
      };
    });
});

const currentMeasure = computed(() =>
  tickToMeasureNumber(playheadTicks.value, props.timeSignatures, props.tpqn),
);

const currentTempo = computed(() => {
  const maybeTempo = props.tempos.findLast((tempo) => {
    return tempo.position <= playheadTicks.value;
  });
  if (!maybeTempo) {
    throw new Error("At least one tempo exists.");
  }
  return maybeTempo;
});

const currentTimeSignature = computed(() => {
  const maybeTimeSignature = props.timeSignatures.findLast((timeSignature) => {
    return timeSignature.measureNumber <= currentMeasure.value;
  });
  if (!maybeTimeSignature) {
    throw new Error("At least one time signature exists.");
  }
  return maybeTimeSignature;
});

const tempoChangeExists = computed(
  () => currentTempo.value.position === playheadTicks.value,
);

const timeSignatureChangeExists = computed(
  () => currentTimeSignature.value.measureNumber === currentMeasure.value,
);

const contextMenuHeader = computed(() => {
  const texts = [];
  if (tempoChangeExists.value) {
    texts.push(`テンポ：${currentTempo.value.bpm}`);
  }
  if (timeSignatureChangeExists.value) {
    texts.push(
      `拍子：${currentTimeSignature.value.beats}/${currentTimeSignature.value.beatType}`,
    );
  }
  return texts.join("、");
});

// FIXME: 各レーンごとにコンテキストメニューを分離
const contextMenuData = computed<ContextMenuItemData[]>(() => {
  const menuData: ContextMenuItemData[] = [];
  menuData.push({
    type: "button",
    label: tempoChangeExists.value ? `テンポ変化を編集` : "テンポ変化を挿入",
    onClick: async () => {
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
      contextMenu.value?.hide();
    },
    disableWhenUiLocked: true,
  });
  if (tempoChangeExists.value) {
    menuData.push({
      type: "button",
      label: "テンポ変化を削除",
      disabled: currentTempo.value.position === 0,
      onClick: () => {
        emit("removeTempo", playheadTicks.value);
        contextMenu.value?.hide();
      },
      disableWhenUiLocked: true,
    });
  }
  menuData.push({
    type: "separator",
  });
  menuData.push({
    type: "button",
    label: timeSignatureChangeExists.value
      ? `拍子変化を編集`
      : "拍子変化を挿入",
    onClick: async () => {
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
      contextMenu.value?.hide();
    },
    disableWhenUiLocked: true,
  });
  if (timeSignatureChangeExists.value) {
    menuData.push({
      type: "button",
      label: "拍子変化を削除",
      disabled: currentMeasure.value === 1,
      onClick: () => {
        emit("removeTimeSignature", currentMeasure.value);
        contextMenu.value?.hide();
      },
      disableWhenUiLocked: true,
    });
  }
  return menuData;
});

const onValueChangeClick = (
  event: MouseEvent,
  valueChange: { position: number },
) => {
  playheadTicks.value = valueChange.position;
  contextMenu.value?.show(event);
};
</script>

<style scoped lang="scss">
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
  z-index: 100;
}
</style>
