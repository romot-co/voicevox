export const PHONEME_TIMING_LAYOUT = {
  noteHeightPx: 24,
  rowGapPx: 16,
  bandHeightPx: 32,
  labelGapPx: 8,
  labelHeightPx: 16,
  topPaddingStepPx: 8,
  noteTickHeightPx: 6,
  lyricMinWidthPx: 16,
  bandGapPx: 4,
  narrowBandGapPx: 2,
  narrowBandThresholdPx: 12,
  bandRadiusPx: 6,
  bridgeMinOffsetPx: 6,
  bridgeBendOffsetPx: 4,
  notePositionMinOffsetPx: 1.5,
  notePositionDashPx: 1.5,
  notePositionDashGapPx: 3,
  ghostDashPx: 2,
  ghostDashGapPx: 3,
  handleWidthPx: 4,
  activeHandleWidthPx: 5,
  handleHeightPx: 8,
  activeHandleHeightPx: 12,
  handleRadiusPx: 1.5,
  labelSpacingPx: 1,
  labelMinWidthPx: 8,
  vowelLabelMinSpanPx: 22,
  labelFontSizePx: 13,
  chipPaddingPx: 6,
  chipHeightPx: 20,
} as const;

export const PHONEME_LABEL_FONT = `500 ${PHONEME_TIMING_LAYOUT.labelFontSizePx}px "Unhinted Rounded M+ 1p Medium", sans-serif`;

/** 固定した行の寸法から、ノート行と音素帯の配置を求める。 */
export function getPhonemeTimingLayout(height: number) {
  const noteHeight = PHONEME_TIMING_LAYOUT.noteHeightPx;
  const rowGap = PHONEME_TIMING_LAYOUT.rowGapPx;
  const bandHeight = PHONEME_TIMING_LAYOUT.bandHeightPx;
  const labelGap = PHONEME_TIMING_LAYOUT.labelGapPx;
  const labelHeight = PHONEME_TIMING_LAYOUT.labelHeightPx;
  const blockHeight = noteHeight + rowGap + bandHeight + labelGap + labelHeight;
  const step = PHONEME_TIMING_LAYOUT.topPaddingStepPx;
  const noteTop = Math.max(
    step,
    Math.round((height - blockHeight) / (2 * step)) * step,
  );
  const bandTop = noteTop + noteHeight + rowGap;
  return {
    noteTop,
    noteHeight,
    rowGap,
    bandTop,
    bandHeight,
    labelTop: bandTop + bandHeight + labelGap,
  };
}
