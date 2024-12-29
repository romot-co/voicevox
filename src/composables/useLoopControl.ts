import { computed } from "vue";
import { useStore } from "@/store";
import { tickToSecond, getNoteDuration } from "@/sing/domain";
import { baseXToTick } from "@/sing/viewHelper";
import { TimeSignature } from "@/store/type";

export function useLoopControl() {
  const store = useStore();

  // 指定されたtickの位置にある拍子記号と、その開始位置を取得
  const getTimeSignatureAtTick = (
    timeSignatures: TimeSignature[],
    tick: number,
    tpqn: number,
  ): { timeSignature: TimeSignature; startTick: number } => {
    // 拍子記号を小節番号でソート
    const sortedTimeSignatures = [...timeSignatures].sort(
      (a, b) => a.measureNumber - b.measureNumber,
    );

    // 各拍子記号の開始位置（tick）を計算
    let currentTick = 0;
    const timeSignatureStartTicks = sortedTimeSignatures.map((ts, index) => {
      const prevTs = index > 0 ? sortedTimeSignatures[index - 1] : null;
      const prevMeasureNum = prevTs ? prevTs.measureNumber : 0;
      const measureDiff = ts.measureNumber - prevMeasureNum;

      if (prevTs) {
        // 前の拍子記号から現在の拍子記号までの小節数分のtickを加算
        currentTick += measureDiff * getMeasureLength(prevTs, tpqn);
      }

      return {
        timeSignature: ts,
        startTick: currentTick,
      };
    });

    // tickが含まれる拍子記号を探す
    for (let i = timeSignatureStartTicks.length - 1; i >= 0; i--) {
      if (timeSignatureStartTicks[i].startTick <= tick) {
        return timeSignatureStartTicks[i];
      }
    }

    return timeSignatureStartTicks[0];
  };

  // 1小節の長さを計算（拍子記号の分母を考慮）
  const getMeasureLength = (
    timeSignature: TimeSignature,
    tpqn: number,
  ): number => {
    // 全音符の長さ（tick）
    const wholeNoteTicks = tpqn * 4;
    // 拍子記号の分母から1拍の長さを計算（例：8分音符なら全音符の1/8）
    const beatLengthTicks = wholeNoteTicks / timeSignature.beatType;
    // 拍子記号の分子（拍数）を掛けて1小節の長さを得る
    return beatLengthTicks * timeSignature.beats;
  };

  // 指定されたtickが含まれる小節の開始位置と拍子記号を取得
  const getMeasureInfo = (
    tick: number,
    tpqn: number,
  ): { startTick: number; timeSignature: TimeSignature } => {
    const { timeSignature, startTick: timeSignatureStartTick } =
      getTimeSignatureAtTick(store.state.timeSignatures, tick, tpqn);
    const measureLength = getMeasureLength(timeSignature, tpqn);
    const ticksFromTimeSignature = tick - timeSignatureStartTick;
    const measureCount = Math.floor(ticksFromTimeSignature / measureLength);
    const measureStartTick =
      timeSignatureStartTick + measureCount * measureLength;
    return { startTick: measureStartTick, timeSignature };
  };

  const isLoopEnabled = computed(() => store.state.isLoopEnabled);
  const loopStartTick = computed(() => store.state.loopStartTick);
  const loopEndTick = computed(() => store.state.loopEndTick);

  const loopStartTime = computed(() => {
    if (loopStartTick.value == null) return null;
    return tickToSecond(
      loopStartTick.value,
      store.state.tempos,
      store.state.tpqn,
    );
  });

  const loopEndTime = computed(() => {
    if (loopEndTick.value == null) return null;
    return tickToSecond(
      loopEndTick.value,
      store.state.tempos,
      store.state.tpqn,
    );
  });

  const setLoopEnabled = async (value: boolean): Promise<void> => {
    try {
      await store.dispatch("COMMAND_SET_LOOP_ENABLED", {
        isLoopEnabled: value,
      });
    } catch (error) {
      throw new Error("Failed to set loop enabled state", { cause: error });
    }
  };

  const setLoopRange = async (
    startTick: number,
    endTick: number,
  ): Promise<void> => {
    try {
      await store.dispatch("COMMAND_SET_LOOP_RANGE", {
        loopStartTick: startTick,
        loopEndTick: endTick,
      });
    } catch (error) {
      throw new Error("Failed to set loop range", { cause: error });
    }
  };

  const clearLoopRange = async (): Promise<void> => {
    try {
      await store.dispatch("COMMAND_CLEAR_LOOP_RANGE");
    } catch (error) {
      throw new Error("Failed to clear loop range", { cause: error });
    }
  };

  const snapToGrid = (tick: number): number => {
    const sequencerSnapType = store.state.sequencerSnapType;
    const snapInterval = getNoteDuration(sequencerSnapType, store.state.tpqn);
    return Math.round(tick / snapInterval) * snapInterval;
  };

  const addOneMeasureLoop = (
    x: number,
    offset: number,
    tpqn: number,
    zoomX: number,
  ) => {
    const baseX = (offset + x) / zoomX;
    const cursorTick = baseXToTick(baseX, tpqn);

    // カーソル位置の小節の情報を取得
    const { startTick, timeSignature } = getMeasureInfo(cursorTick, tpqn);

    // その小節の長さを計算（拍子記号の分母を考慮）
    const oneMeasureTicks = getMeasureLength(timeSignature, tpqn);

    // ループ範囲を設定（小節の開始位置から1小節分）
    void setLoopRange(startTick, startTick + oneMeasureTicks);
  };

  return {
    isLoopEnabled,
    loopStartTick,
    loopEndTick,
    loopStartTime,
    loopEndTime,
    setLoopEnabled,
    setLoopRange,
    clearLoopRange,
    snapToGrid,
    addOneMeasureLoop,
  };
}
