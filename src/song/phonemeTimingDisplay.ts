import type { NoteId } from "@/type/preload";
import type {
  PhonemeTimingInfo,
  PhonemeTimingPreview,
} from "@/song/phonemeTimingEditorStateMachine/common";
import { getNext } from "@/song/utility";

/** プレビューと表示上の順序制約を適用した音素境界。 */
export type PhonemeDisplayInfo = PhonemeTimingInfo & {
  noteId: NoteId;
  startTime: number;
  displayState: "default" | "edited" | "movePreview";
};

/** ノートに属する境界と、休符を含まない音素帯の範囲。 */
export type PhonemeDisplayGroup = {
  noteId: NoteId;
  phonemes: PhonemeDisplayInfo[];
  startTime: number;
  endTime: number;
};

/** 編集プレビューを適用し、隣接する境界の表示順を維持する。 */
export function buildPhonemeDisplayInfos(
  infos: readonly PhonemeTimingInfo[],
  preview: PhonemeTimingPreview | undefined,
  editorFrameRate: number,
): PhonemeDisplayInfo[] {
  const result: PhonemeDisplayInfo[] = [];
  for (const info of infos) {
    // 先頭のpauには操作対象のノートがない。
    if (info.noteId == undefined) continue;
    const isMovePreview =
      preview?.type === "move" &&
      preview.noteId === info.noteId &&
      preview.phonemeIndexInNote === info.phonemeIndexInNote;
    const isErasePreview =
      preview?.type === "erase" &&
      preview.targets.some(
        (target) =>
          target.noteId === info.noteId &&
          target.phonemeIndexInNote === info.phonemeIndexInNote,
      );
    result.push({
      ...info,
      noteId: info.noteId,
      startTime: isErasePreview
        ? info.originalStartTimeSeconds
        : isMovePreview
          ? info.originalStartTimeSeconds + preview.offsetSeconds
          : info.editedStartTimeSeconds,
      displayState: isMovePreview
        ? "movePreview"
        : info.isEdited && !isErasePreview
          ? "edited"
          : "default",
    });
  }
  // 復元プレビューで隣の編集済み境界を越えても、表示順は入れ替えない。
  for (let i = result.length - 1; i >= 0; i--) {
    const next = getNext(result, i);
    if (next != undefined) {
      result[i].startTime = Math.min(
        result[i].startTime,
        next.startTime - 1 / editorFrameRate,
      );
    }
  }
  return result;
}

/** 隣のノートとの境界を共有し、末尾pauの開始で音素帯を閉じる。 */
export function groupPhonemeDisplayInfos(
  infos: readonly PhonemeDisplayInfo[],
): PhonemeDisplayGroup[] {
  const groups: PhonemeDisplayGroup[] = [];
  for (const [i, info] of infos.entries()) {
    let group = groups.at(-1);
    if (group?.noteId !== info.noteId) {
      group = {
        noteId: info.noteId,
        phonemes: [],
        startTime: info.startTime,
        endTime: info.editedEndTimeSeconds,
      };
      groups.push(group);
    }
    group.phonemes.push(info);
    const next = getNext(infos, i);
    group.endTime =
      info.phoneme === "pau"
        ? info.startTime
        : next?.phraseKey === info.phraseKey
          ? next.startTime
          : info.editedEndTimeSeconds;
  }
  return groups;
}
