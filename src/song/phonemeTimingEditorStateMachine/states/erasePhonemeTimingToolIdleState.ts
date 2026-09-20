import { PHONEME_TIMING_HIT_THRESHOLD_PX } from "@/song/phonemeTimingEditorStateMachine/common";
import type { SetNextState, State } from "@/song/stateMachine";
import type {
  PhonemeTimingEditorContext,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingTarget,
} from "@/song/phonemeTimingEditorStateMachine/common";
import { getButton, tickToBaseX } from "@/song/viewHelper";
import { secondToTick } from "@/song/music";

export class ErasePhonemeTimingToolIdleState implements State<
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorContext
> {
  readonly id = "erasePhonemeTimingToolIdle";

  onEnter(context: PhonemeTimingEditorContext) {
    context.cursorState.value = "UNSET";
    context.hoveredPhoneme.value = undefined;
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
    const phonemeTimingEditData = context.phonemeTimingEditData.value;

    if (input.type === "pointerEvent") {
      if (
        input.pointerEvent.type === "pointerleave" &&
        input.targetArea === "PhonemeTimingArea"
      ) {
        context.hoveredPhoneme.value = undefined;
        context.cursorState.value = "UNSET";
        return;
      }
      const mouseButton = getButton(input.pointerEvent);
      const selectedTrackId = context.selectedTrackId.value;

      const isPointerMove =
        input.pointerEvent.type === "pointermove" &&
        input.targetArea === "PhonemeTimingArea";
      const isPointerDown =
        input.pointerEvent.type === "pointerdown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "PhonemeTimingArea";

      if (!isPointerMove && !isPointerDown) {
        return;
      }

      // 編集済み音素タイミングのヒットテスト
      const threshold = PHONEME_TIMING_HIT_THRESHOLD_PX;
      let minDistance = Infinity;
      let nearest: PhonemeTimingTarget | undefined;
      for (const phonemeTimingInfo of phonemeTimingInfos) {
        if (phonemeTimingInfo.noteId == undefined) {
          continue;
        }

        // 編集済みかどうか確認
        const phonemeTimingEdits = phonemeTimingEditData.get(
          phonemeTimingInfo.noteId,
        );
        const hasExistingEdit =
          phonemeTimingEdits?.some(
            (edit) =>
              edit.phonemeIndexInNote === phonemeTimingInfo.phonemeIndexInNote,
          ) ?? false;

        if (!hasExistingEdit) {
          continue;
        }

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
        if (distance <= threshold && distance < minDistance) {
          minDistance = distance;
          nearest = {
            noteId: phonemeTimingInfo.noteId,
            phonemeIndexInNote: phonemeTimingInfo.phonemeIndexInNote,
          };
        }
      }

      const hovered = context.hoveredPhoneme.value;
      if (
        hovered?.noteId !== nearest?.noteId ||
        hovered?.phonemeIndexInNote !== nearest?.phonemeIndexInNote
      ) {
        context.hoveredPhoneme.value = nearest;
      }

      if (nearest != undefined) {
        if (isPointerMove) {
          context.cursorState.value = "ERASE";
        } else {
          setNextState("erasePhonemeTiming", {
            targetTrackId: selectedTrackId,
            startPositionX: input.positionX,
            returnStateId: this.id,
          });
        }
      } else if (isPointerMove) {
        context.cursorState.value = "UNSET";
      } else if (isPointerDown) {
        // 編集済み音素がない場所でクリックした場合でも削除状態に遷移
        // （ドラッグで他の編集済み音素を削除できるようにするため）
        setNextState("erasePhonemeTiming", {
          targetTrackId: selectedTrackId,
          startPositionX: input.positionX,
          returnStateId: this.id,
        });
      }
    }
  }

  onExit(context: PhonemeTimingEditorContext) {
    context.cursorState.value = "UNSET";
    context.hoveredPhoneme.value = undefined;
  }
}
