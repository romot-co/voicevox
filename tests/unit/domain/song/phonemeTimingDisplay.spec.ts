import { describe, expect, it } from "vitest";
import { NoteId } from "@/type/preload";
import { PhraseKey } from "@/store/type";
import type { PhonemeTimingInfo } from "@/song/phonemeTimingEditorStateMachine/common";
import {
  buildPhonemeDisplayInfos,
  groupPhonemeDisplayInfos,
} from "@/song/phonemeTimingDisplay";

const a = NoteId("a");
const b = NoteId("b");
const phraseKey = PhraseKey("phrase");
const createInfo = (
  noteId: NoteId | undefined,
  phoneme: string,
  index: number,
  start: number,
  end: number,
): PhonemeTimingInfo => ({
  phraseKey,
  noteId,
  phoneme,
  phonemeIndexInNote: index,
  isEdited: false,
  originalStartTimeSeconds: start,
  editedStartTimeSeconds: start,
  editedEndTimeSeconds: end,
});
const infos = [
  createInfo(undefined, "pau", 0, 0, 1),
  createInfo(a, "k", 0, 1, 1.1),
  createInfo(a, "I", 1, 1.1, 1.3),
  createInfo(a, "a", 2, 1.3, 2),
  createInfo(b, "a", 0, 2, 3),
  createInfo(b, "pau", 1, 3, 4),
];

describe("音素タイミングの表示", () => {
  it("先頭の休符を除き、複数音素と母音のみのノートを末尾の休符までまとめる", () => {
    const groups = groupPhonemeDisplayInfos(
      buildPhonemeDisplayInfos(infos, undefined, 100),
    );
    expect(
      groups.map((group) => ({
        noteId: group.noteId,
        phonemes: group.phonemes.map((p) => p.phoneme),
        start: group.startTime,
        end: group.endTime,
      })),
    ).toEqual([
      { noteId: a, phonemes: ["k", "I", "a"], start: 1, end: 2 },
      { noteId: b, phonemes: ["a", "pau"], start: 2, end: 3 },
    ]);
  });

  it("先頭境界の移動プレビューに両隣の帯が追従する", () => {
    const groups = groupPhonemeDisplayInfos(
      buildPhonemeDisplayInfos(
        infos,
        {
          type: "move",
          noteId: b,
          phonemeIndexInNote: 0,
          offsetSeconds: -0.2,
        },
        100,
      ),
    );
    expect(groups[0].endTime).toBe(1.8);
    expect(groups[1].startTime).toBe(1.8);
    expect(groups[1].phonemes[0].displayState).toBe("movePreview");
    expect(infos[4].editedStartTimeSeconds).toBe(2);
  });

  it("末尾pauの移動で帯を伸縮し、休符や次のフレーズを塗らない", () => {
    const nextPhrase = createInfo(NoteId("c"), "a", 0, 5, 6);
    nextPhrase.phraseKey = PhraseKey("next");
    const groups = groupPhonemeDisplayInfos(
      buildPhonemeDisplayInfos(
        [...infos, nextPhrase],
        {
          type: "move",
          noteId: b,
          phonemeIndexInNote: 1,
          offsetSeconds: 0.25,
        },
        100,
      ),
    );
    expect(groups[1].endTime).toBe(3.25);
    expect(groups[1].phonemes.at(-1)?.startTime).toBe(3.25);
    expect(groups[2].startTime).toBe(5);
  });

  it("消去プレビューは元の位置へ戻り、隣接帯も更新する", () => {
    const edited = infos.map((info) =>
      info.noteId === b && info.phonemeIndexInNote === 0
        ? { ...info, isEdited: true, editedStartTimeSeconds: 2.2 }
        : info,
    );
    const groups = groupPhonemeDisplayInfos(
      buildPhonemeDisplayInfos(
        edited,
        {
          type: "erase",
          targets: [{ noteId: b, phonemeIndexInNote: 0 }],
        },
        100,
      ),
    );
    expect(groups[0].endTime).toBe(2);
    expect(groups[1].startTime).toBe(2);
    expect(groups[1].phonemes[0].displayState).toBe("default");
  });

  it("消去で次の境界を越える場合も既存の1フレーム制約で表示順を保つ", () => {
    const edited = [
      {
        ...createInfo(a, "k", 0, 1, 1.2),
        isEdited: true,
        originalStartTimeSeconds: 1.5,
      },
      createInfo(a, "a", 1, 1.2, 2),
    ];
    const displayed = buildPhonemeDisplayInfos(
      edited,
      {
        type: "erase",
        targets: [{ noteId: a, phonemeIndexInNote: 0 }],
      },
      100,
    );
    expect(displayed[0].startTime).toBeCloseTo(1.19);
    expect(edited[0].editedStartTimeSeconds).toBe(1);
  });
});
