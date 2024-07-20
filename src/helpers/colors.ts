import Color from "colorjs.io";

import {
  OKLCHCoords,
  ColorSchemeConfig,
  ColorSchemeBaseColors,
  CustomColorConfig,
  ColorScheme,
  PALETTE_TONES,
  COLOR_ROLES,
} from "@/type/preload";

// HexからOKLCHに変換
export const oklchFromHex = (hex: string): OKLCHCoords => {
  try {
    const color = new Color(hex);
    return [color.l, color.c, color.h];
  } catch (error) {
    throw new Error(`Failed to convert hex to OKLCH: ${hex}, ${error}`);
  }
};

export const hexFromOklch = (oklchCoords: OKLCHCoords): string => {
  try {
    const color = new Color("oklch", oklchCoords);
    return color.to("srgb").toString({ format: "hex" });
  } catch (error) {
    throw new Error(`Failed to convert OKLCH to hex: ${oklchCoords}, ${error}`);
  }
};

// OKLCHの制約
const MIN_L = 0;
const MAX_L = 1;
const MIN_C = 0;
const MAX_C = 0.4;
const MIN_H = 0;
const MAX_H = 360;

// 追加スキーマ(仮: 適当に設定...理屈に合わせたい)
export const generateVoiceVoxVitaminColors = (
  baseColors: ColorSchemeBaseColors,
): ColorSchemeBaseColors => {
  const [l, c, h] = baseColors.primary;
  return {
    primary: [Math.min(l * 1.1, 0.72), Math.min(c * 1.5, MAX_C), h],
    secondary: [
      baseColors.secondary[0] + 0.1,
      Math.min(baseColors.secondary[1] * 1.5, 0.35),
      baseColors.secondary[2],
    ],
    tertiary: [
      Math.min(l * 1.05, 0.72),
      Math.min(c * 1.1, 0.4),
      (h + 180) % 360,
    ],
    neutral: [Math.min(l * 0.9, MAX_L), Math.min(c * 0.1, MAX_C), h],
    neutralVariant: [
      Math.min(baseColors.neutralVariant[0], MAX_L),
      Math.min(baseColors.neutralVariant[1], MAX_C),
      baseColors.neutralVariant[2],
    ],
    error: [
      Math.min(baseColors.error[0] * 1.5, MAX_L),
      Math.min(baseColors.error[1] * 1.5, MAX_C),
      baseColors.error[2],
    ],
  };
};

// ベースカラー調整関数
export const adjustBaseColor = (
  baseColor: OKLCHCoords,
  isDark: boolean,
): OKLCHCoords => {
  let [l, c, h] = baseColor;

  // 明度の調整
  l = isDark ? 1 - l : l;
  // 彩度の調整
  c = Math.max(MIN_C, Math.min(MAX_C, c));
  // 色相の調整
  h = (h + MAX_H) % MAX_H;

  return [l, c, h];
};

// 補正明るさ取得
const getLightness = (
  baseColor: OKLCHCoords,
  toneValue: number,
  isDark: boolean,
): OKLCHCoords => {
  const toneColor = [...baseColor] as OKLCHCoords;
  toneColor[0] = toneValue / 100;
  if (isDark) {
    const baseLightness = 0.08 + (1 - toneValue / 100) * 0.08;
    toneColor[0] = baseLightness + (toneValue / 100) * 0.92;
  } else {
    // ライトモードはそのまま
    toneColor[0] = toneValue / 100;
  }

  return toneColor;
};

// カラーブレンド関数
export const blendColors = (
  color1: OKLCHCoords,
  color2: OKLCHCoords,
  amount: number,
): OKLCHCoords => {
  const blendedColor = color1.map(
    (value, index) => value * (1 - amount) + color2[index] * amount,
  ) as OKLCHCoords;

  return blendedColor;
};

// パレット生成関数
export const generatePalette = (
  baseColors: ColorSchemeBaseColors,
  isDark: boolean,
): Record<string, OKLCHCoords> => {
  const palette: Record<string, OKLCHCoords> = {};
  Object.entries(baseColors).forEach(([key, colorValue]) => {
    const baseColor = adjustBaseColor(colorValue, isDark);
    PALETTE_TONES.forEach((tone) => {
      palette[`${key}${tone}`] = getLightness(baseColor, tone, isDark);
    });
  });
  return palette;
};

// カスタムカラー生成関数
export const generateCustomColors = (
  customColors: CustomColorConfig[],
  baseColors: ColorSchemeBaseColors,
  isDark: boolean,
  palette: Record<string, OKLCHCoords>,
): Record<string, OKLCHCoords> => {
  const customColorMap: Record<string, OKLCHCoords> = {};

  customColors.forEach((config) => {
    const baseColor = adjustBaseColor(baseColors[config.palette], isDark);
    const tone = isDark ? config.darkLightness : config.lightLightness;
    let color = getLightness(baseColor, tone, isDark);

    if (config.blend) {
      const surfaceColor = palette[isDark ? "neutral10" : "neutral99"];
      color = blendColors(color, surfaceColor, 0.15);
    }

    customColorMap[config.name] = color;
  });

  return customColorMap;
};

// ロールごとのカラーを生成
export const generateRoleColors = (
  baseColors: ColorSchemeBaseColors,
  isDark: boolean,
): Record<string, OKLCHCoords> => {
  const roles: Record<string, OKLCHCoords> = {};
  Object.entries(COLOR_ROLES).forEach(([name, [base, light, dark]]) => {
    roles[name] = getLightness(
      adjustBaseColor(baseColors[base], isDark),
      isDark ? dark : light,
      isDark,
    );
  });

  return roles;
};

export const generateColorScheme = (config: ColorSchemeConfig): ColorScheme => {
  let baseColors = config.baseColors;
  baseColors = generateVoiceVoxVitaminColors(config.baseColors);
  const palette = generatePalette(baseColors, config.isDark);
  const roles = generateRoleColors(baseColors, config.isDark);
  const customColors = generateCustomColors(
    config.customColors ?? [],
    config.baseColors,
    config.isDark,
    palette,
  );

  const colorScheme = {
    config,
    palette,
    roles,
    customColors,
  };

  const report = evaluateContrastAndGenerateResults(colorScheme, config, false);
  printContrastResults(report);

  return colorScheme;
};

// CSSVariablesにコンバート
export const cssVariablesFromColorScheme = (
  colorScheme: ColorScheme,
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  const setColorVar = (prefix: string, key: string, value: OKLCHCoords) => {
    cssVars[`--${prefix}-${toKebabCase(key)}`] = hexFromOklch(value);
    cssVars[`--${prefix}-${toKebabCase(key)}-oklch`] =
      `oklch(${value[0]} ${value[1]} ${value[2]})`;
  };

  // パレットのCSS変数
  Object.entries(colorScheme.palette).forEach(([key, value]) => {
    setColorVar("md-ref-palette", key, value);
  });

  // ロールのCSS変数
  Object.entries(colorScheme.roles).forEach(([key, value]) => {
    setColorVar("md-sys-color", key, value);
  });

  // カスタムカラーのCSS変数
  Object.entries(colorScheme.customColors).forEach(([key, value]) => {
    setColorVar("md-custom-color", key, value);
  });

  return cssVars;
};

//--- 以下評価用

// WCAGコントラストチェック
export const getWCAGContrast = (
  color1: OKLCHCoords,
  color2: OKLCHCoords,
): number => {
  const color1SRGB = new Color("oklch", color1).to("srgb");
  const color2SRGB = new Color("oklch", color2).to("srgb");
  const contrast = Color.contrastWCAG21(color1SRGB, color2SRGB);
  return contrast;
};

// APCAコントラストチェック
export const getAPCAContrast = (
  color1: OKLCHCoords,
  color2: OKLCHCoords,
): number => {
  const color1SRGB = new Color("oklch", color1).to("srgb");
  const color2SRGB = new Color("oklch", color2).to("srgb");
  return Color.contrastAPCA(color1SRGB, color2SRGB);
};

interface ContrastCheckResult {
  color1Name: string;
  color2Name: string;
  color1: OKLCHCoords;
  color2: OKLCHCoords;
  wcagContrastRatio: number;
  apcaContrastValue: number;
  checkType: string;
  wcagEvaluation: string;
  apcaEvaluation: string;
  functionalCheck: string;
  designCheck: string;
  expectedContrastRatio?: number;
}

// APCAコントラスト評価
function evaluateAPCAContrast(
  apcaContrast: number,
  fontSize: number,
  isNormalWeight: boolean,
): string {
  const absContrast = Math.abs(apcaContrast);
  if (fontSize >= 24) {
    // ラージテキスト（24px以上）
    if (absContrast >= 60) return "Lc60+ (Preferred)";
    if (absContrast >= 45) return "Lc45+ (Minimum Large)";
    return "Fail";
  } else if (fontSize >= 18) {
    // ミディアムテキスト（18-23px）
    if (isNormalWeight) {
      if (absContrast >= 75) return "Lc75+ (Preferred)";
      if (absContrast >= 60) return "Lc60+ (Minimum Medium)";
      return "Fail";
    } else {
      if (absContrast >= 60) return "Lc60+ (Preferred Bold)";
      if (absContrast >= 55) return "Lc55+ (Minimum Medium Bold)";
      return "Fail";
    }
  } else {
    // スモールテキスト（18px未満）
    if (isNormalWeight) {
      if (absContrast >= 90) return "Lc90+ (Preferred)";
      if (absContrast >= 75) return "Lc75+ (Minimum)";
      return "Fail";
    } else {
      if (absContrast >= 75) return "Lc75+ (Preferred Bold)";
      if (absContrast >= 60) return "Lc60+ (Minimum Bold)";
      return "Fail";
    }
  }
}

// コントラスト評価関数
function evaluateContrast(
  wcagContrastRatio: number,
  apcaContrastValue: number,
  checkType: string,
  color1Name: string,
  color2Name: string,
  color1: OKLCHCoords,
  color2: OKLCHCoords,
  expectedContrastRatio?: number,
): ContrastCheckResult {
  const wcagAANormal = wcagContrastRatio >= 4.5;
  const wcagAALarge = wcagContrastRatio >= 3;
  const wcagAAANormal = wcagContrastRatio >= 7;
  const wcagAAALarge = wcagContrastRatio >= 4.5;

  let wcagEvaluation = "";
  let apcaEvaluation = "";
  let functionalCheck = "";
  let designCheck = "";

  switch (checkType) {
    case "text":
      wcagEvaluation = wcagAAANormal ? "AAA" : wcagAANormal ? "AA" : "Fail";
      apcaEvaluation = evaluateAPCAContrast(apcaContrastValue, 16, true);
      functionalCheck = apcaEvaluation.includes("Fail") ? "Fail" : "Pass";
      designCheck = Math.abs(apcaContrastValue) >= 75 ? "Good" : "Poor";
      break;
    case "largeText":
      wcagEvaluation = wcagAAALarge ? "AAA" : wcagAALarge ? "AA" : "Fail";
      apcaEvaluation = evaluateAPCAContrast(apcaContrastValue, 24, true);
      functionalCheck = apcaEvaluation.includes("Fail") ? "Fail" : "Pass";
      designCheck = Math.abs(apcaContrastValue) >= 60 ? "Good" : "Poor";
      break;
    case "ui":
      wcagEvaluation = wcagAALarge ? "Pass" : "Fail";
      apcaEvaluation = evaluateAPCAContrast(apcaContrastValue, 24, false);
      functionalCheck = apcaEvaluation.includes("Fail") ? "Fail" : "Pass";
      designCheck = Math.abs(apcaContrastValue) >= 45 ? "Good" : "Poor";
      break;
    case "structure":
      wcagEvaluation = wcagContrastRatio >= 1.5 ? "Pass" : "Fail";
      apcaEvaluation = Math.abs(apcaContrastValue) >= 15 ? "Pass" : "Fail";
      functionalCheck = apcaEvaluation;
      designCheck = Math.abs(apcaContrastValue) >= 20 ? "Good" : "Poor";
      break;
    case "decorative":
      wcagEvaluation = "N/A";
      apcaEvaluation = Math.abs(apcaContrastValue) >= 5 ? "Pass" : "Fail";
      functionalCheck = "N/A";
      designCheck = Math.abs(apcaContrastValue) >= 7 ? "Good" : "Poor";
      break;
    default:
      wcagEvaluation = "Unknown";
      apcaEvaluation = "Unknown";
      functionalCheck = "Unknown";
      designCheck = "Unknown";
  }

  return {
    color1,
    color2,
    color1Name,
    color2Name,
    wcagContrastRatio,
    apcaContrastValue,
    checkType,
    wcagEvaluation,
    apcaEvaluation,
    functionalCheck,
    designCheck,
    expectedContrastRatio,
  };
}

// コントラストチェックしてレポートを出力
export function evaluateContrastAndGenerateResults(
  colorScheme: ColorScheme,
  config: ColorSchemeConfig,
  evaluateAPCAContrast: boolean,
): ContrastCheckResult[] {
  const results: ContrastCheckResult[] = [];
  const colors: Record<string, OKLCHCoords> = {
    ...colorScheme.roles,
    ...colorScheme.customColors,
  };

  function checkContrast(
    color1Name: string,
    color2Name: string,
    checkType: string,
    expectedContrastRatio?: number,
  ) {
    const color1 = colors[color1Name];
    const color2 = colors[color2Name];
    if (!color1 || !color2) {
      console.warn(`Could not find colors: ${color1Name} or ${color2Name}`);
      return;
    }
    const wcagContrastRatio = getWCAGContrast(color1, color2);
    const apcaContrastValue = evaluateAPCAContrast
      ? getAPCAContrast(color1, color2)
      : 0;
    const result = evaluateContrast(
      wcagContrastRatio,
      apcaContrastValue,
      checkType,
      color1Name,
      color2Name,
      color1,
      color2,
      expectedContrastRatio,
    );

    // APCAコントラストチェックは行わない
    if (
      expectedContrastRatio &&
      result.wcagContrastRatio < expectedContrastRatio
    ) {
      results.push(result);
    }
  }

  const standardChecks = [
    { color1: "primary", color2: "onPrimary", type: "text", expected: 4.5 },
    {
      color1: "primaryContainer",
      color2: "onPrimaryContainer",
      type: "text",
      expected: 4.5,
    },
    { color1: "secondary", color2: "onSecondary", type: "text", expected: 4.5 },
    {
      color1: "secondaryContainer",
      color2: "onSecondaryContainer",
      type: "text",
      expected: 4.5,
    },
    { color1: "tertiary", color2: "onTertiary", type: "text", expected: 4.5 },
    {
      color1: "tertiaryContainer",
      color2: "onTertiaryContainer",
      type: "text",
      expected: 4.5,
    },
    { color1: "error", color2: "onError", type: "text", expected: 4.5 },
    {
      color1: "errorContainer",
      color2: "onErrorContainer",
      type: "text",
      expected: 4.5,
    },
    {
      color1: "background",
      color2: "onBackground",
      type: "text",
      expected: 4.5,
    },
    { color1: "surface", color2: "onSurface", type: "text", expected: 4.5 },
    {
      color1: "surfaceVariant",
      color2: "onSurfaceVariant",
      type: "text",
      expected: 4.5,
    },
    {
      color1: "inverseSurface",
      color2: "inverseOnSurface",
      type: "text",
      expected: 4.5,
    },
    { color1: "outline", color2: "background", type: "ui", expected: 3 },
    {
      color1: "outlineVariant",
      color2: "surface",
      type: "structure",
      expected: 1.5,
    },
  ];

  standardChecks.forEach((check) => {
    checkContrast(check.color1, check.color2, check.type, check.expected);
  });

  ["primary", "secondary", "tertiary", "error"].forEach((color) => {
    checkContrast(color, "background", "ui", 3);
    checkContrast(color, "surface", "ui", 3);
  });

  config.customColors?.forEach((customColor: CustomColorConfig) => {
    if (customColor.contrastVs) {
      Object.entries(customColor.contrastVs).forEach(
        ([contrastColor, expectedRatio]) => {
          checkContrast(
            customColor.name,
            contrastColor,
            "custom",
            expectedRatio,
          );
        },
      );
    } else {
      checkContrast(customColor.name, "background", "ui");
      checkContrast(customColor.name, "surface", "ui");
    }
  });

  return results;
}

// consoleに結果を出力
export function printContrastResults(results: ContrastCheckResult[]): void {
  if (results.length === 0) {
    console.log("All color checks passed.");
    return;
  }

  console.warn("Contrast Evaluation Results:");
  results.forEach((result) => {
    console.warn(`
      Name: ${result.color1Name} vs ${result.color2Name}
      Colors: ${hexFromOklch(result.color1)} vs ${hexFromOklch(result.color2)}
      Check Type: ${result.checkType}
      WCAG Contrast Ratio: ${result.wcagContrastRatio.toFixed(2)}:1
      APCA Contrast Value: ${result.apcaContrastValue.toFixed(2)}
      WCAG Evaluation: ${result.wcagEvaluation}
      APCA Evaluation: ${result.apcaEvaluation}
      Functional Check: ${result.functionalCheck}
      Design Check: ${result.designCheck}
      ${result.expectedContrastRatio ? `Expected Contrast Ratio: ${result.expectedContrastRatio.toFixed(2)}:1` : ''}
      --------------------------`);
  });
}
