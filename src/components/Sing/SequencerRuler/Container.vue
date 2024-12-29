<template>
  <!-- Containerは store とのやりとりを行い、Presentation に受け渡す -->
  <Presentation
    v-model:playheadTicks="playheadPosition"
    :offset
    :numMeasures
    :tpqn
    :tempos
    :timeSignatures
    :sequencerZoomX
    :uiLocked
    :sequencerSnapType
    @removeTempo="removeTempo"
    @removeTimeSignature="removeTimeSignature"
    @setTempo="setTempo"
    @setTimeSignature="setTimeSignature"
    @deselectAllNotes="deselectAllNotes"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { useLoopControl } from "@/composables/useLoopControl"; // storeに依存したままのフック

defineOptions({
  name: "SequencerRulerContainer",
});

/** Storeの読み込み */
const store = useStore();

/** Propsや computed で store.state から必要な情報を取得 */
const offset = computed(() => 0); // デモ用: もしスクロール分などを管理しているならここで
const numMeasures = computed(() => store.getters.SEQUENCER_NUM_MEASURES);
const tpqn = computed(() => store.state.tpqn);
const tempos = computed(() => store.state.tempos);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const uiLocked = computed(() => store.getters.UI_LOCKED);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);

/** 再生ヘッド位置 */
const playheadPosition = computed({
  get: () => store.getters.PLAYHEAD_POSITION,
  set: (value: number) => {
    void store.actions.SET_PLAYHEAD_POSITION({ position: value });
  },
});

/** ループ関連 (store依存のフック) */
const { isLoopEnabled, loopStartTick, loopEndTick } = useLoopControl();

/**
 * Presentationからのイベントを store のアクションで処理する
 *
 * 例: playheadを移動
 */
function updatePlayheadTicks(ticks: number) {
  void store.actions.SET_PLAYHEAD_POSITION({ position: ticks });
}

/** テンポ削除 */
function removeTempo(position: number) {
  void store.actions.COMMAND_REMOVE_TEMPO({ position });
}

/** 拍子削除 */
function removeTimeSignature(measureNumber: number) {
  void store.actions.COMMAND_REMOVE_TIME_SIGNATURE({ measureNumber });
}

/** テンポ追加・編集 */
function setTempo(tempo: { bpm: number; position: number }) {
  void store.actions.COMMAND_SET_TEMPO({ tempo });
}

/** 拍子追加・編集 */
function setTimeSignature(ts: {
  beats: number;
  beatType: number;
  measureNumber: number;
}) {
  void store.actions.COMMAND_SET_TIME_SIGNATURE({ timeSignature: ts });
}

/** ノートの全選択解除 */
function deselectAllNotes() {
  void store.actions.DESELECT_ALL_NOTES();
}
</script>
