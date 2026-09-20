import { PHONEME_TIMING_HIT_THRESHOLD_PX } from "@/song/phonemeTimingEditorStateMachine/common";
import type { SetNextState, State } from "@/song/stateMachine";
import type {
  PhonemeTimingEditorContext,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingInfo,
} from "@/song/phonemeTimingEditorStateMachine/common";
import { getButton, tickToBaseX } from "@/song/viewHelper";
import { secondToTick } from "@/song/music";

export class MovePhonemeTimingToolIdleState implements State<
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorContext
> {
  readonly id = "movePhonemeTimingToolIdle";

  onEnter(context: PhonemeTimingEditorContext) {
    context.cursorState.value =
      context.hoveredPhoneme.value == undefined ? "UNSET" : "EW_RESIZE";
  }

  process({
    input,
    context,
    setNextState,
  }: {
    input: PhonemeTimingEditorInput;
    context: PhonemeTimingEditorContext;
    setNextState: SetNextState<PhonemeTimingEditorStateDefinitions>;
  }) {
    const viewportInfo = context.viewportInfo.value;
    const phonemeTimingInfos = context.phonemeTimingInfos.value;

    const event =
      input.type === "pointerEvent" ? input.pointerEvent : input.mouseEvent;
    if (
      event.type === "pointerleave" &&
      input.targetArea === "PhonemeTimingArea"
    ) {
      context.hoveredPhoneme.value = undefined;
      context.cursorState.value = "UNSET";
      return;
    }
    const mouseButton = getButton(event);
    const selectedTrackId = context.selectedTrackId.value;

    const isPointerMove =
      event.type === "pointermove" && input.targetArea === "PhonemeTimingArea";
    const isPointerDown =
      event.type === "pointerdown" &&
      mouseButton === "LEFT_BUTTON" &&
      input.targetArea === "PhonemeTimingArea";

    const isDoubleClick =
      event.type === "dblclick" && mouseButton === "LEFT_BUTTON";

    if (!isPointerMove && !isPointerDown && !isDoubleClick) {
      return;
    }

    // ヒットテスト
    const threshold = PHONEME_TIMING_HIT_THRESHOLD_PX;
    let nearest: PhonemeTimingInfo | undefined;
    let minDistance: number | undefined = undefined;
    for (const phonemeTimingInfo of phonemeTimingInfos) {
      const phonemeStartTicks = secondToTick(
        phonemeTimingInfo.editedStartTimeSeconds,
        context.tempos.value,
        context.tpqn.value,
      );
      const phonemeStartBaseX = tickToBaseX(
        phonemeStartTicks,
        context.tpqn.value,
      );
      const phonemeStartX = Math.round(
        phonemeStartBaseX * viewportInfo.scaleX - viewportInfo.offsetX,
      );

      const distance = Math.abs(phonemeStartX - input.positionX);
      if (
        distance <= threshold &&
        (minDistance == undefined || distance < minDistance)
      ) {
        minDistance = distance;
        nearest = phonemeTimingInfo;
      }
    }

    if (isPointerMove) {
      const hovered = context.hoveredPhoneme.value;
      if (nearest?.noteId == undefined) {
        context.hoveredPhoneme.value = undefined;
      } else if (
        hovered?.noteId !== nearest.noteId ||
        hovered.phonemeIndexInNote !== nearest.phonemeIndexInNote
      ) {
        context.hoveredPhoneme.value = {
          noteId: nearest.noteId,
          phonemeIndexInNote: nearest.phonemeIndexInNote,
        };
      }
    }

    if (nearest != undefined && nearest.noteId != undefined) {
      if (isPointerMove) {
        context.cursorState.value = "EW_RESIZE";
      } else if (isDoubleClick) {
        if (nearest.isEdited) {
          void context.store.actions.COMMAND_ERASE_PHONEME_TIMING_EDITS({
            trackId: selectedTrackId,
            targets: [
              {
                noteId: nearest.noteId,
                phonemeIndexInNote: nearest.phonemeIndexInNote,
              },
            ],
          });
        }
      } else {
        setNextState("movePhonemeTiming", {
          targetTrackId: selectedTrackId,
          noteId: nearest.noteId,
          phonemeIndexInNote: nearest.phonemeIndexInNote,
          startPositionX: input.positionX,
          returnStateId: this.id,
        });
      }
    } else if (isPointerMove) {
      context.cursorState.value = "UNSET";
    }
  }

  // 押下・解放による状態遷移では、同じ境界のホバー表示を維持する。
  onExit() {}
}
