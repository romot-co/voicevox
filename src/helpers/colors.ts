import { Color, oklch, css, srgb, mix } from "@thi.ng/color";

import {
  ColorSchemeConfig,
  CustomColorConfig,
  ColorScheme,
  PALETTE_TONES,
  COLOR_ROLES,
} from "@/type/preload";

// 最小・最大
const MIN_CHROMA = 0.005;
const MAX_CHROMA = 0.4; // 最大彩度: OKLCHの実用限度 // Gammutいりそう
const LIGHT_MIN_L = 0.0;
const LIGHT_MAX_L = 1.0;
const DARK_MIN_L = 0.08; // 最小明るさ制限
const DARK_MAX_L = 0.98; // 最大明るさ制限

// デフォルト
const SECONDARY_HUE_SHIFT = 0;
const TERTIARY_HUE_SHIFT = 120;
const PRIMARY_CHROMA = 0.1;
const SECONDARY_CHROMA = PRIMARY_CHROMA / 2.5;

// 仮
const hermiteInterpolation = (
  t: number,
  p0: number,
  p1: number,
  m0: number,
  m1: number,
): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0 +
    (t3 - 2 * t2 + t) * m0 +
    (-2 * t3 + 3 * t2) * p1 +
    (t3 - t2) * m1
  );
};

// TODO: HCTのパレットトーン設定とはOKLCHのLは当然一致せずめんどくさい形に
// OKLCHの考え方からしても、本来Lの設定値だけ変えればいいはずなので、パレットトーン設定側を見直すのが本筋？
export const adjustColor = (
  baseColor: Color,
  targetLightness: number,
  isDark: boolean,
): Color => {
  const [, c, h] = oklch(baseColor);

  const normalizedTargetL = targetLightness / 100;
  let adjustedLightness: number;

  if (isDark) {
    // ダークモードのトーンカーブ補正(明度が微妙に一致しないため)
    // 0,1は維持 / 暗い方を少し持ち上げる / 明るい方を少し押し下げる
    const darkCurve = (t: number) => {
      return Math.max(
        Math.min(hermiteInterpolation(t, 0, 1, 1.8, 0.9), DARK_MAX_L),
        DARK_MIN_L,
      );
    };
    adjustedLightness = darkCurve(normalizedTargetL);
  } else {
    // ライトモードは線形のまま
    adjustedLightness = Math.max(
      Math.min(normalizedTargetL, LIGHT_MAX_L),
      LIGHT_MIN_L,
    );
  }

  // クロマの調整（明度に応じた非線形調整）
  const chromaFactor = 1 - Math.pow(Math.abs(2 * adjustedLightness - 1), 2);
  const maxChroma = MAX_CHROMA * chromaFactor;
  const adjustedChroma = Math.max(MIN_CHROMA, Math.min(c, maxChroma));

  return oklch([adjustedLightness, adjustedChroma, h]);
};

// カラーブレンド関数
export const blendColors = (
  color1: Color,
  color2: Color,
  amount: number,
): Color => {
  return mix([], oklch(color1), oklch(color2), amount);
};

// 新しい関数: ベースカラーから他の色を生成
const generateColorSet = (
  primaryColor: Color,
  config: ColorSchemeConfig,
): Record<string, Color> => {
  const colors: Record<string, Color> = {
    primary: primaryColor,
  };

  if (config.baseColors.secondary) {
    colors.secondary = oklch(config.baseColors.secondary);
  } else {
    const [, , h] = oklch(primaryColor);
    colors.secondary = oklch([
      config.isDark ? 0.3 : 0.7,
      SECONDARY_CHROMA,
      (h + SECONDARY_HUE_SHIFT) % 1,
    ]);
  }

  if (config.baseColors.tertiary) {
    colors.tertiary = oklch(config.baseColors.tertiary);
  } else {
    const [, , h] = oklch(primaryColor);
    colors.tertiary = oklch([
      config.isDark ? 0.3 : 0.7,
      PRIMARY_CHROMA,
      (h + TERTIARY_HUE_SHIFT) % 1,
    ]);
  }

  if (config.baseColors.neutral) {
    colors.neutral = oklch(config.baseColors.neutral);
  } else {
    const [l, , h] = oklch(primaryColor);
    colors.neutral = oklch([l, MIN_CHROMA, h]);
  }

  if (config.baseColors.neutralVariant) {
    colors.neutralVariant = oklch(config.baseColors.neutralVariant);
  } else {
    const [l, c, h] = oklch(colors.neutral);
    colors.neutralVariant = oklch([l, c * 1.2, h]);
  }

  if (config.baseColors.error) {
    colors.error = oklch(config.baseColors.error);
  } else {
    colors.error = oklch([0.5, 0.3, 25 / 360]);
  }

  return colors;
};

// パレット生成関数
export const generatePalette = (
  baseColors: Record<string, Color[]>,
  isDark: boolean,
): Record<string, Color> => {
  const palette: Record<string, Color> = {};
  Object.entries(baseColors).forEach(([key, colorValue]) => {
    PALETTE_TONES.forEach((tone) => {
      palette[`${key}${tone}`] = adjustColor(colorValue[0], tone, isDark);
    });
  });
  return palette;
};

// カスタムカラー生成関数
export const generateCustomColors = (
  customColors: CustomColorConfig[],
  baseColors: Record<string, Color[]>,
  isDark: boolean,
  palette: Record<string, Color>,
): Record<string, Color> => {
  const customColorMap: Record<string, Color> = {};

  customColors.forEach((config) => {
    const basePalette = baseColors[config.palette];
    const lightness = isDark ? config.darkLightness : config.lightLightness;
    let color = adjustColor(basePalette[0], lightness, isDark);

    if (config.blend) {
      const surfaceColor = palette[isDark ? "primary10" : "primary90"];
      color = blendColors(color, surfaceColor, 0);
    }

    customColorMap[config.name] = color;
  });

  return customColorMap;
};

// ロールごとのカラーを生成
export const generateRoleColors = (
  baseColors: Record<string, Color[]>,
  isDark: boolean,
): Record<string, Color> => {
  const roles: Record<string, Color> = {};
  Object.entries(COLOR_ROLES).forEach(([name, [base, light, dark]]) => {
    const lightness = isDark ? dark : light;
    const color = adjustColor(baseColors[base][0], lightness, isDark);
    roles[name] = color;
  });

  return roles;
};

// カラースキーム生成
export const generateColorScheme = (config: ColorSchemeConfig): ColorScheme => {
  const primaryKeyColor = oklch(config.baseColors.primary);
  const baseHue = primaryKeyColor.h;
  const primaryColor = oklch([0.4, PRIMARY_CHROMA, baseHue]);
  const baseColorsArray = generateColorSet(primaryColor, config);
  const baseColors: Record<string, Color[]> = {};
  Object.keys(baseColorsArray).forEach((key) => {
    baseColors[key] = [baseColorsArray[key]];
  });
  const palette = generatePalette(baseColors, config.isDark);
  const roles = generateRoleColors(baseColors, config.isDark);
  const customColors = generateCustomColors(
    config.customColors ?? [],
    baseColors,
    config.isDark,
    palette,
  );

  return {
    config,
    palette,
    roles,
    customColors,
  };
};

// CSSVariablesにコンバート
export const cssVariablesFromColorScheme = (
  colorScheme: ColorScheme,
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  const setColorVar = (prefix: string, key: string, value: Color) => {
    const [l, c, h] = oklch(value);
    const hex = css(srgb(oklch([l, c, h])));
    cssVars[`--${prefix}-${toKebabCase(key)}`] = hex;
    cssVars[`--${prefix}-${toKebabCase(key)}-oklch`] =
      `oklch(${l} ${c} ${h * 360})`;
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

// WCAG 相対輝度計算関数
export const getRelativeLuminance = (color: Color): number => {
  // impl
  return 1;
};

// WCAG2.1 コントラスト比計算関数
export const getContrastRatio = (color1: Color, color2: Color): number => {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

interface ContrastCheckResult {
  color1Name: string;
  color2Name: string;
  color1: string;
  color2: string;
  wcagContrastRatio: number;
  checkType: string;
  wcagEvaluation: string;
  functionalCheck: string;
  designCheck: string;
  expectedContrastRatio?: number;
}

export const evaluateContrast = (
  contrastRatio: number,
  checkType: string,
  color1: Color,
  color2: Color,
  color1Name: string,
  color2Name: string,
  expectedContrastRatio?: number,
): ContrastCheckResult => {
  const wcagAANormal = contrastRatio >= 4.5;
  const wcagAALarge = contrastRatio >= 3;
  const wcagAAANormal = contrastRatio >= 7;
  const wcagAAALarge = contrastRatio >= 4.5;

  // 機能チェック
  let functionalCheck = "";
  // デザイン基準チェック
  let designCheck = "";

  switch (checkType) {
    case "text":
      functionalCheck = wcagAAANormal
        ? "Pass AAA"
        : wcagAANormal
          ? "Pass AA"
          : "Fail";
      designCheck = "N/A";
      break;
    case "largeText":
      functionalCheck = wcagAAALarge
        ? "Pass AAA"
        : wcagAALarge
          ? "Pass AA"
          : "Fail";
      designCheck = "N/A";
      break;
    case "ui":
      functionalCheck = wcagAALarge ? "Pass" : "Fail";
      designCheck = contrastRatio >= 3.0 ? "Good" : "Poor";
      break;
    case "structure":
      functionalCheck = contrastRatio >= 1.5 ? "Pass" : "Fail";
      designCheck = contrastRatio >= 1.5 ? "Good" : "Poor";
      break;
    case "decorative":
      functionalCheck = "N/A";
      designCheck = contrastRatio >= 1.2 ? "Good" : "Poor";
      break;
    case "custom":
      functionalCheck = "Custom";
      designCheck = "Custom";
      break;
  }

  return {
    color1: css(color1),
    color2: css(color2),
    color1Name,
    color2Name,
    wcagContrastRatio: contrastRatio,
    checkType,
    wcagEvaluation:
      contrastRatio >= 7
        ? "AAA"
        : contrastRatio >= 4.5
          ? "AA"
          : contrastRatio >= 3
            ? "AA Large"
            : "Fail",
    functionalCheck,
    designCheck,
    expectedContrastRatio,
  };
}

export const evaluateContrastAndGenerateResults = (
  colorScheme: ColorScheme,
  config: ColorSchemeConfig,
): ContrastCheckResult[] => {
  const results: ContrastCheckResult[] = [];
  const colors: Record<string, Color> = {
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

    const contrastRatio = getContrastRatio(color1, color2);
    const result = evaluateContrast(
      contrastRatio,
      checkType,
      color1,
      color2,
      color1Name,
      color2Name,
      expectedContrastRatio,
    );

    if (
      expectedContrastRatio == undefined ||
      contrastRatio < expectedContrastRatio
    ) {
      results.push(result);
    }
  }

  const colorPairs = [
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
    { color1: "outlineVariant", color2: "surface", type: "ui", expected: 1.5 },
  ];

  colorPairs.forEach((pair) => {
    checkContrast(pair.color1, pair.color2, pair.type, pair.expected);
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
};

// 評価結果をコンソールに出力する関数
export const printContrastResults = (results: ContrastCheckResult[]): void => {
  if (results.length === 0) {
    console.log("All color checks passed.");
    return;
  }

  console.warn("Contrast Evaluation Results:");
  results.forEach((result) => {
    console.warn(`
      Name: ${result.color1Name} vs ${result.color2Name}
      Colors: ${css(result.color1)} vs ${css(result.color2)}
      Check Type: ${result.checkType}
      Contrast Ratio: ${result.wcagContrastRatio.toFixed(2)}:1
      ${
        result.expectedContrastRatio
          ? `Expected Contrast Ratio: ${result.expectedContrastRatio.toFixed(
              2,
            )}:1`
          : ""
      }
      WCAG Evaluation: ${result.wcagEvaluation}
      Functional Check: ${result.functionalCheck}
      Design Check: ${result.designCheck}
      --------------------------`);
  });
};
