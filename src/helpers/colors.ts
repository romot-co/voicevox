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

export const oklchFromHex = (hex: string): OKLCHCoords => {
  try {
    const color = new Color(hex);
    return [color.l, color.c, color.h];
  } catch (error) {
    console.warn(`Failed to convert hex to OKLCH: ${hex}`, error);
    return [0, 0, 0];
  }
};

export const hexFromOklch = (oklchCoords: OKLCHCoords): string => {
  try {
    const color = new Color("oklch", oklchCoords);
    return color.to("srgb").toString({ format: "hex" });
  } catch (error) {
    console.warn(`Failed to convert OKLCH to hex: ${oklchCoords}`, error);
    return "#FFFFFF";
  }
};

// OKLCHの制約
const MIN_L = 0;
const MAX_L = 1;
const MIN_C = 0;
const MAX_C = 0.4;
const MIN_H = 0;
const MAX_H = 360;

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
    toneColor[0] = baseLightness + (toneValue / 100) * 0.9;
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

// コントラスト取得関数
export const getContrastRatio = (
  color1: OKLCHCoords,
  color2: OKLCHCoords,
): number => {
  const color1SRGB = new Color("oklch", color1).to("srgb");
  const color2SRGB = new Color("oklch", color2).to("srgb");
  const contrast = Color.contrastWCAG21(color1SRGB, color2SRGB);
  return contrast;
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

// カラースキーム生成関数
export const generateColorScheme = (config: ColorSchemeConfig): ColorScheme => {
  const palette = generatePalette(config.baseColors, config.isDark);

  const roles: Record<string, OKLCHCoords> = {};
  Object.entries(COLOR_ROLES).forEach(([name, [base, light, dark]]) => {
    roles[name] = getLightness(
      adjustBaseColor(config.baseColors[base], config.isDark),
      config.isDark ? dark : light,
      config.isDark,
    );
  });

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

  const report = evaluateContrastAndGenerateResults(colorScheme, config);
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

// コントラストチェック結果のインターフェース
interface ContrastCheckResult {
  color1Name: string;
  color2Name: string;
  color1: OKLCHCoords;
  color2: OKLCHCoords;
  contrastRatio: number;
  checkType: string;
  wcagAANormal: boolean;
  wcagAALarge: boolean;
  wcagAAANormal: boolean;
  wcagAAALarge: boolean;
  functionalCheck: string;
  designCheck: string;
  expectedContrastRatio?: number;
}

// コントラスト評価関数
function evaluateContrast(
  contrastRatio: number,
  checkType: string,
  color1Name: string,
  color2Name: string,
  color1: OKLCHCoords,
  color2: OKLCHCoords,
  expectedContrastRatio?: number,
): ContrastCheckResult {
  const wcagAANormal = contrastRatio >= 4.5;
  const wcagAALarge = contrastRatio >= 3;
  const wcagAAANormal = contrastRatio >= 7;
  const wcagAAALarge = contrastRatio >= 4.5;

  let functionalCheck = "";
  let designCheck = "";

  switch (checkType) {
    case "text":
      functionalCheck = wcagAAANormal
        ? "Pass AAA"
        : wcagAANormal
          ? "Pass AA"
          : "Fail";
      designCheck = contrastRatio >= 4.5 ? "Good" : "Poor";
      break;
    case "largeText":
      functionalCheck = wcagAAALarge
        ? "Pass AAA"
        : wcagAALarge
          ? "Pass AA"
          : "Fail";
      designCheck = contrastRatio >= 3 ? "Good" : "Poor";
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
      functionalCheck =
        contrastRatio >= expectedContrastRatio! ? "Pass" : "Fail";
      designCheck = contrastRatio >= expectedContrastRatio! ? "Good" : "Poor";
      break;
    default:
      functionalCheck = "Unknown";
      designCheck = "Unknown";
  }

  return {
    color1,
    color2,
    color1Name,
    color2Name,
    contrastRatio,
    checkType,
    wcagAANormal,
    wcagAALarge,
    wcagAAANormal,
    wcagAAALarge,
    functionalCheck,
    designCheck,
    expectedContrastRatio,
  };
}

export function evaluateContrastAndGenerateResults(
  colorScheme: ColorScheme,
  config: ColorSchemeConfig,
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
    const contrastRatio = getContrastRatio(color1, color2);
    const result = evaluateContrast(
      contrastRatio,
      checkType,
      color1Name,
      color2Name,
      color1,
      color2,
      expectedContrastRatio,
    );
    if (
      expectedContrastRatio == undefined ||
      contrastRatio < expectedContrastRatio
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

export function printContrastResults(results: ContrastCheckResult[]): void {
  if (results.length === 0) {
    console.log("All color checks passed.");
    return;
  }

  console.warn("The following color contrasts need attention:");
  results.forEach((result) => {
    console.warn(`
    Name: ${result.color1Name} vs ${result.color2Name}
    Colors: ${hexFromOklch(result.color1)} vs ${hexFromOklch(result.color2)}
    Check Type: ${result.checkType}
    Contrast Ratio: ${result.contrastRatio.toFixed(2)}:1
    ${result.expectedContrastRatio ? `Expected Contrast Ratio: ${result.expectedContrastRatio.toFixed(2)}:1` : ""}
    WCAG AA (Normal Text): ${result.wcagAANormal ? "Pass" : "Fail"}
    WCAG AA (Large Text/UI): ${result.wcagAALarge ? "Pass" : "Fail"}
    WCAG AAA (Normal Text): ${result.wcagAAANormal ? "Pass" : "Fail"}
    WCAG AAA (Large Text): ${result.wcagAAALarge ? "Pass" : "Fail"}
    Functional Check: ${result.functionalCheck}
    Design Check: ${result.designCheck}
    `);
  });
}
