import { computed, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteId, TrackId } from "@/type/preload";
import { PhraseKey } from "@/store/type";
import { secondToTick } from "@/song/music";
import { createDefaultTrack } from "@/song/domain";
import { tickToBaseX } from "@/song/viewHelper";
import type { PhonemeTimingEditorContext } from "@/song/phonemeTimingEditorStateMachine/common";
import { MovePhonemeTimingToolIdleState } from "@/song/phonemeTimingEditorStateMachine/states/movePhonemeTimingToolIdleState";
import { createPhonemeTimingEditorStateMachine } from "@/song/phonemeTimingEditorStateMachine";
import { ErasePhonemeTimingToolIdleState } from "@/song/phonemeTimingEditorStateMachine/states/erasePhonemeTimingToolIdleState";

const noteId = NoteId("note");
const createContext = (): PhonemeTimingEditorContext => {
  const track = createDefaultTrack();
  track.phonemeTimingEditData.set(noteId, [
    { phonemeIndexInNote: 1, offsetSeconds: 0.2 },
  ]);
  return {
    store: {
      state: {
        tpqn: 480,
        tempos: [{ position: 0, bpm: 120 }],
        phrases: new Map(),
        phraseQueries: new Map(),
        editorFrameRate: 100,
        sequencerPhonemeTimingTool: "MOVE",
      },
      getters: {
        SELECTED_TRACK_ID: TrackId("track"),
        SELECTED_TRACK: track,
      },
      actions: {
        COMMAND_ERASE_PHONEME_TIMING_EDITS: vi.fn(),
        COMMAND_UPSERT_PHONEME_TIMING_EDIT: vi.fn(),
      },
    },
    editorFrameRate: computed(() => 100),
    previewMode: ref("IDLE"),
    previewPhonemeTiming: ref(undefined),
    phraseInfos: computed(
      () =>
        new Map([
          [
            PhraseKey("phrase"),
            {
              startTime: 0,
              query: {
                frameRate: 100,
                f0: [],
                volume: [],
                phonemes: [],
                volumeScale: 1,
                outputSamplingRate: 24000,
                outputStereo: false,
              },
              minNonPauseStartFrame: undefined,
              maxNonPauseEndFrame: undefined,
            },
          ],
        ]),
    ),
    hoveredPhoneme: ref(undefined),
    cursorState: ref("UNSET"),
    selectedTrackId: computed(() => TrackId("track")),
    viewportInfo: computed(() => ({
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    })),
    tempos: computed(() => [{ position: 0, bpm: 120 }]),
    tpqn: computed(() => 480),
    phonemeTimingInfos: computed(() => [
      {
        phraseKey: PhraseKey("phrase"),
        noteId,
        phonemeIndexInNote: 1,
        phoneme: "pau",
        isEdited: true,
        originalStartTimeSeconds: 0.8,
        editedStartTimeSeconds: 1,
        editedEndTimeSeconds: 2,
      },
    ]),
    phonemeTimingEditData: computed(() => track.phonemeTimingEditData),
  };
};

const states = [
  MovePhonemeTimingToolIdleState,
  ErasePhonemeTimingToolIdleState,
];

describe.each(states)("音素境界のホバー %s", (State) => {
  it("末尾pauも±6pxで対象になり、離脱で解除される", () => {
    const context = createContext();
    const state = new State();
    const x = tickToBaseX(secondToTick(1, context.tempos.value, 480), 480);
    const process = (type: string, offset: number) =>
      state.process({
        context,
        setNextState: vi.fn(),
        input: {
          type: "pointerEvent",
          targetArea: "PhonemeTimingArea",
          positionX: x + offset,
          pointerEvent: { type, button: 0 } as PointerEvent,
        },
      });
    state.onEnter(context);
    process("pointermove", 6);
    expect(context.hoveredPhoneme.value).toEqual({
      noteId,
      phonemeIndexInNote: 1,
    });
    const hovered = context.hoveredPhoneme.value;
    process("pointermove", 5);
    expect(context.hoveredPhoneme.value).toBe(hovered);
    process("pointermove", 7);
    expect(context.hoveredPhoneme.value).toBeUndefined();
    process("pointermove", 0);
    process("pointerleave", 0);
    expect(context.hoveredPhoneme.value).toBeUndefined();
    expect(context.cursorState.value).toBe("UNSET");
  });
});

it("消しゴムは空白からでもなぞり消しに入れる", () => {
  const context = createContext();
  const state = new ErasePhonemeTimingToolIdleState();
  const setNextState = vi.fn();
  state.process({
    context,
    setNextState,
    input: {
      type: "pointerEvent",
      targetArea: "PhonemeTimingArea",
      positionX: 1000,
      pointerEvent: { type: "pointerdown", button: 0 } as PointerEvent,
    },
  });
  expect(setNextState).toHaveBeenCalledWith(
    "erasePhonemeTiming",
    expect.objectContaining({ startPositionX: 1000 }),
  );
});

describe("音素境界のダブルクリック", () => {
  it.each([
    { edited: true, offset: 0, button: 0, resets: true },
    { edited: false, offset: 0, button: 0, resets: false },
    { edited: true, offset: 7, button: 0, resets: false },
    { edited: true, offset: 0, button: 2, resets: false },
  ])(
    "$edited / 距離$offset / ボタン$button",
    ({ edited, offset, button, resets }) => {
      const context = createContext();
      context.phonemeTimingInfos.value[0].isEdited = edited;
      const state = new MovePhonemeTimingToolIdleState();
      const setNextState = vi.fn();
      const x = tickToBaseX(secondToTick(1, context.tempos.value, 480), 480);
      state.process({
        context,
        setNextState,
        input: {
          type: "mouseEvent",
          targetArea: "PhonemeTimingArea",
          positionX: x + offset,
          mouseEvent: { type: "dblclick", button } as MouseEvent,
        },
      });
      const erase = context.store.actions.COMMAND_ERASE_PHONEME_TIMING_EDITS;
      expect(vi.mocked(erase).mock.calls).toEqual(
        resets
          ? [
              [
                {
                  trackId: TrackId("track"),
                  targets: [{ noteId, phonemeIndexInNote: 1 }],
                },
              ],
            ]
          : [],
      );
      expect(setNextState).not.toHaveBeenCalled();
    },
  );
});

describe("音素境界のクリックとドラッグ", () => {
  afterEach(() => vi.unstubAllGlobals());

  const setup = () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const context = createContext();
    context.phonemeTimingInfos.value.unshift({
      phraseKey: PhraseKey("phrase"),
      noteId,
      phonemeIndexInNote: 0,
      phoneme: "a",
      isEdited: false,
      originalStartTimeSeconds: 0.5,
      editedStartTimeSeconds: 0.5,
      editedEndTimeSeconds: 1,
    });
    const state = createPhonemeTimingEditorStateMachine(
      context,
      "movePhonemeTimingToolIdle",
    );
    const xOf = (seconds: number) =>
      tickToBaseX(secondToTick(seconds, context.tempos.value, 480), 480);
    const x = xOf(1);
    const send = (type: string, positionX = x) =>
      state.process({
        type: "pointerEvent",
        targetArea: "PhonemeTimingArea",
        positionX,
        pointerEvent: { type, button: 0 } as PointerEvent,
      });
    const flush = () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(0));
    };
    send("pointermove");
    return { context, state, x, xOf, send, flush };
  };

  it("ダブルクリックの押下と解放でホバー表示を変えず、編集だけを消す", () => {
    const { context, state, x, send, flush } = setup();
    const hovered = context.hoveredPhoneme.value;
    for (let i = 0; i < 2; i++) {
      send("pointerdown");
      flush();
      expect(context.hoveredPhoneme.value).toBe(hovered);
      expect(context.previewPhonemeTiming.value).toBeUndefined();
      send("pointerup");
      expect(context.hoveredPhoneme.value).toBe(hovered);
      expect(context.previewPhonemeTiming.value).toBeUndefined();
      expect(context.cursorState.value).toBe("EW_RESIZE");
    }
    state.process({
      type: "mouseEvent",
      targetArea: "PhonemeTimingArea",
      positionX: x,
      mouseEvent: { type: "dblclick", button: 0 } as MouseEvent,
    });
    expect(context.hoveredPhoneme.value).toBe(hovered);
    expect(
      context.store.actions.COMMAND_UPSERT_PHONEME_TIMING_EDIT,
    ).not.toHaveBeenCalled();
    expect(
      context.store.actions.COMMAND_ERASE_PHONEME_TIMING_EDITS,
    ).toHaveBeenCalledOnce();
  });

  it("同じ位置や1px未満の揺れではプレビューせず、移動して初めて表示する", () => {
    const { context, send, x, xOf, flush } = setup();
    send("pointerdown");
    send("pointermove");
    flush();
    expect(context.previewPhonemeTiming.value).toBeUndefined();
    send("pointermove", x + 0.5);
    flush();
    expect(context.previewPhonemeTiming.value).toBeUndefined();
    send("pointermove", xOf(1.2));
    flush();
    expect(context.previewPhonemeTiming.value?.type).toBe("move");
    send("pointercancel");
    expect(context.previewPhonemeTiming.value).toBeUndefined();
    expect(
      context.store.actions.COMMAND_UPSERT_PHONEME_TIMING_EDIT,
    ).not.toHaveBeenCalled();
  });

  it("描画待ちのまま離しても解放位置の値を確定する", () => {
    const { context, send, xOf } = setup();
    send("pointerdown");
    send("pointermove", xOf(1.1));
    send("pointerup", xOf(1.2));
    const apply = vi.mocked(
      context.store.actions.COMMAND_UPSERT_PHONEME_TIMING_EDIT,
    );
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0][0].phonemeTimingEdit.offsetSeconds).toBeCloseTo(
      0.4,
    );
    expect(context.previewPhonemeTiming.value).toBeUndefined();
  });

  it("ドラッグ中の離脱ではホバーを消さず、キャンセルで編集を確定しない", () => {
    const { context, send, xOf, flush } = setup();
    const hovered = context.hoveredPhoneme.value;
    send("pointerdown");
    send("pointermove", xOf(1.2));
    flush();
    send("pointerleave");
    expect(context.hoveredPhoneme.value).toBe(hovered);
    expect(context.previewPhonemeTiming.value?.type).toBe("move");
    send("pointercancel");
    expect(context.hoveredPhoneme.value).toBe(hovered);
    expect(
      context.store.actions.COMMAND_UPSERT_PHONEME_TIMING_EDIT,
    ).not.toHaveBeenCalled();
  });

  it("動かしてから元の位置に戻した場合は編集を追加しない", () => {
    const { context, send, xOf, flush } = setup();
    send("pointerdown");
    send("pointermove", xOf(1.2));
    flush();
    send("pointermove");
    flush();
    const preview = context.previewPhonemeTiming.value;
    expect(
      preview?.type === "move" ? preview.offsetSeconds : undefined,
    ).toBeCloseTo(0.2);
    send("pointerup");
    expect(
      context.store.actions.COMMAND_UPSERT_PHONEME_TIMING_EDIT,
    ).not.toHaveBeenCalled();
  });
});
