<template>
  <Presentation
    :width="rulerWidth"
    :playheadX
    :offset="props.offset"
    :hoverPlayheadX
    @click="handleClick"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <!-- TODO: 各コンポーネントもなるべく疎にしたつもりだが、少なくともplayheadまわりがリファクタリング必要そう -->
    <template #grid>
      <GridLaneContainer />
    </template>
    <template #changes>
      <ValueChangesLaneContainer />
    </template>
    <template #loop>
      <LoopLaneContainer />
    </template>
  </Presentation>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Presentation from "./Presentation.vue";
import GridLaneContainer from "./GridLane/Container.vue";
import ValueChangesLaneContainer from "./ValueChangesLane/Container.vue";
import LoopLaneContainer from "./LoopLane/Container.vue";
import { useStore } from "@/store";
import { useSequencerLayout } from "@/composables/useSequencerLayout";
import { offsetXToSnappedTick } from "@/sing/rulerHelper";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";
import { getNoteDuration } from "@/sing/domain";

defineOptions({
  name: "SequencerRuler",
});

const props = withDefaults(
  defineProps<{
    offset?: number;
    numMeasures?: number;
  }>(),
  {
    offset: 0,
    numMeasures: 32,
  },
);

const store = useStore();

// 基本的な値
const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const playheadPosition = computed(() => store.getters.PLAYHEAD_POSITION);

// useSequencerLayoutを使用してレイアウト計算を行う
const { rulerWidth, playheadX } = useSequencerLayout({
  timeSignatures,
  tpqn,
  playheadPosition,
  sequencerZoomX,
  offset: computed(() => props.offset),
  numMeasures: computed(() => props.numMeasures),
});

// ホバー時のダミーplayhead位置
const hoverPlayheadX = ref<number | null>(null);

// マウスの移動時にホバーplayheadの位置を更新
const handleMouseMove = (event: MouseEvent) => {
  // LoopLaneの上にいる場合はダミープレイヘッドを表示しない
  const target = event.target as HTMLElement;
  const isOnLoopLane = target.closest(".sequencer-ruler-loop") != null;
  if (isOnLoopLane) {
    hoverPlayheadX.value = null;
    return;
  }

  const snapTicks = getNoteDuration(store.state.sequencerSnapType, tpqn.value);
  const offsetX = event.offsetX + props.offset;
  const baseX = offsetX / sequencerZoomX.value;
  const baseTicks = baseXToTick(baseX, tpqn.value);

  // シーケンサーのスナップ設定に基づいてスナップ
  const snappedTicks = Math.round(baseTicks / snapTicks) * snapTicks;
  const snappedBaseX = tickToBaseX(snappedTicks, tpqn.value);
  hoverPlayheadX.value = Math.floor(snappedBaseX * sequencerZoomX.value) - 0.5;
};

// MouseLeaveでダミーplayheadを非表示
const handleMouseLeave = () => {
  hoverPlayheadX.value = null;
};

// 再生ヘッド位置の設定
const setPlayheadPosition = (ticks: number) => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: ticks });
};

// ノートの選択解除
const deselectAllNotes = () => {
  void store.actions.DESELECT_ALL_NOTES();
};

// クリック時のハンドラ
const handleClick = (event: MouseEvent) => {
  deselectAllNotes();
  // LoopLane上かどうかを判定
  const target = event.target as HTMLElement;
  const isOnLoopLane = target.closest(".sequencer-ruler-loop") != null;
  if (isOnLoopLane) {
    // LoopLane上の場合は従来のスナップ処理(仮)
    const ticks = offsetXToSnappedTick(
      event.offsetX,
      props.offset,
      sequencerZoomX.value,
      timeSignatures.value,
      tpqn.value,
    );
    setPlayheadPosition(ticks);
    return;
  }
  const snapTicks = getNoteDuration(store.state.sequencerSnapType, tpqn.value);
  const offsetX = event.offsetX + props.offset;
  const baseX = offsetX / sequencerZoomX.value;
  const baseTicks = baseXToTick(baseX, tpqn.value);
  const snappedTicks = Math.round(baseTicks / snapTicks) * snapTicks;
  setPlayheadPosition(snappedTicks);
};
</script>
