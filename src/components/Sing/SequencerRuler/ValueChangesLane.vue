<template>
  <div class="sequencer-ruler-value-changes-lane">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height="24"
      shape-rendering="crispEdges"
    >
      <!-- テンポ・拍子表示 -->
      <template v-for="valueChange in valueChanges" :key="valueChange.position">
        <text
          ref="valueChangeText"
          font-size="12"
          :x="valueChange.x - offset + valueChangeTextPadding"
          y="16"
          class="sequencer-ruler-value-change"
          @click.stop="(event) => handleValueChangeClick(event, valueChange)"
          @contextmenu.stop="handleContextMenu"
        >
          {{ valueChange.displayText }}
        </text>
        <line
          :x1="valueChange.x - offset"
          :x2="valueChange.x - offset"
          y1="0"
          :y2="24"
          class="sequencer-ruler-value-change-line"
        />
      </template>
    </svg>
    <ContextMenu
      ref="contextMenu"
      :header="contextMenuHeader"
      :menudata="contextMenuData"
      :uiLocked="props.uiLocked"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useTemplateRef } from "vue";
import { FontSpecification, predictTextWidth } from "@/helpers/textWidth";
import { createLogger } from "@/domain/frontend/log";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Presentation.vue";
import { tickToBaseX } from "@/sing/viewHelper";
import { Tempo, TimeSignature } from "@/store/type";
import { getTimeSignaturePositions } from "@/sing/domain";
import { UnreachableError } from "@/type/utility";

const props = defineProps<{
  width: number;
  offset: number;
  tpqn: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  sequencerZoomX: number;
  uiLocked: boolean;
  playheadTicks: number;
  currentMeasure: number;
}>();

const emit = defineEmits<{
  valueChangeClick: [event: MouseEvent, valueChange: { position: number }];
  editTempo: [];
  removeTempo: [];
  editTimeSignature: [];
  removeTimeSignature: [];
}>();

type ValueChange = {
  position: number;
  text: string;
  tempoChange: Tempo | undefined;
  timeSignatureChange: TimeSignature | undefined;
  x: number;
  displayText: string;
};

const log = createLogger("ValueChangesLane");

const valueChangeTextPadding = 4;
const contextMenu = ref<InstanceType<typeof ContextMenu>>();

// テキスト幅の計算
// NOTE: フォントの変更に対応していないが、基本的にフォントが変更されることは少ないので、
// 複雑性を下げるためにも対応しない
const valueChangeText = useTemplateRef<SVGTextElement[]>("valueChangeText");
const valueChangeTextStyle = computed<FontSpecification | null>(() => {
  if (!valueChangeText.value || valueChangeText.value.length === 0) {
    return null;
  }
  try {
    const style = window.getComputedStyle(valueChangeText.value[0]);
    return {
      fontFamily: style.fontFamily,
      fontSize: parseFloat(style.fontSize),
      fontWeight: style.fontWeight,
    };
  } catch (error) {
    log.error("assert: Failed to get text style");
    return null;
  }
});

// 拍子変更の位置を計算
const tsPositions = computed(() => {
  return getTimeSignaturePositions(props.timeSignatures, props.tpqn);
});

const valueChanges = computed<ValueChange[]>(() => {
  const timeSignaturesWithTicks = tsPositions.value.map((tsPosition, i) => ({
    type: "timeSignature" as const,
    position: tsPosition,
    timeSignature: props.timeSignatures[i],
  }));
  const tempos = props.tempos.map((tempo) => {
    return {
      type: "tempo" as const,
      position: tempo.position,
      tempo,
    };
  });

  const valueChanges: ValueChange[] = [
    ...Map.groupBy(
      [...tempos, ...timeSignaturesWithTicks],
      (item) => item.position,
    ).entries(),
  ]
    .toSorted((a, b) => a[0] - b[0])
    .map(([tick, items]) => {
      const tempo = items.find((item) => item.type === "tempo")?.tempo;
      const timeSignature = items.find(
        (item) => item.type === "timeSignature",
      )?.timeSignature;

      const tempoText = tempo?.bpm ?? "";
      const timeSignatureText = timeSignature
        ? `${timeSignature.beats}/${timeSignature.beatType}`
        : "";

      const text = [tempoText, timeSignatureText].join(" ");

      return {
        position: tick,
        text,
        tempoChange: tempo,
        timeSignatureChange: timeSignature,
        x: tickToBaseX(tick, props.tpqn) * props.sequencerZoomX,
        displayText: text,
      };
    });

  if (valueChangeTextStyle.value != undefined) {
    // NOTE: テキストの幅を計算して、表示できるかどうかを判定する
    //   full: 通常表示（120 4/4）
    //   ellipsis: fullが入りきらないときに表示する（...）
    //   hidden: ellipsisも入りきらないときに表示する

    const collapsedTextWidth =
      predictTextWidth("...", valueChangeTextStyle.value) +
      valueChangeTextPadding * 2;
    for (const [i, valueChange] of valueChanges.entries()) {
      const next = valueChanges.at(i + 1);
      if (!next) {
        continue;
      }
      const requiredWidth =
        predictTextWidth(valueChange.text, valueChangeTextStyle.value) +
        valueChangeTextPadding;
      const width = next.x - valueChange.x;
      if (collapsedTextWidth > width) {
        valueChange.displayText = "";
      } else if (requiredWidth > width) {
        valueChange.displayText = "...";
      }
    }
  } else {
    log.warn("valueChangeTextElement is null. Cannot calculate text width.");
  }

  return valueChanges;
});

const handleValueChangeClick = (
  event: MouseEvent,
  valueChange: { position: number },
) => {
  event.preventDefault();
  event.stopPropagation();
  emit("valueChangeClick", event, valueChange);
  contextMenu.value?.show(event);
};

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  contextMenu.value?.show(event);
};

// コンテキストメニューのヘッダー
const contextMenuHeader = computed(() => {
  const texts = [];
  if (tempoChangeExists.value) {
    texts.push(`テンポ：${currentTempo.value.bpm}`);
  }
  if (timeSignatureChangeExists.value) {
    texts.push(
      `拍子：${currentTimeSignature.value.beats}/${currentTimeSignature.value.beatType}`,
    );
  }
  return texts.join("、");
});

// コンテキストメニューのデータ
const contextMenuData = computed<ContextMenuItemData[]>(() => {
  const menuData: ContextMenuItemData[] = [];

  // テンポ変更メニュー項目
  menuData.push({
    type: "button",
    label: tempoChangeExists.value ? "テンポ変化を編集" : "テンポ変化を挿入",
    onClick: () => {
      contextMenu.value?.hide();
      emit("editTempo");
    },
    disableWhenUiLocked: true,
  });

  if (tempoChangeExists.value) {
    menuData.push({
      type: "button",
      label: "テンポ変化を削除",
      onClick: () => {
        contextMenu.value?.hide();
        emit("removeTempo");
      },
      disableWhenUiLocked: true,
    });
  }

  menuData.push({ type: "separator" });

  // 拍子変更メニュー項目
  menuData.push({
    type: "button",
    label: timeSignatureChangeExists.value
      ? "拍子変化を編集"
      : "拍子変化を挿入",
    onClick: () => {
      contextMenu.value?.hide();
      emit("editTimeSignature");
    },
    disableWhenUiLocked: true,
  });

  if (timeSignatureChangeExists.value) {
    menuData.push({
      type: "button",
      label: "拍子変化を削除",
      onClick: () => {
        contextMenu.value?.hide();
        emit("removeTimeSignature");
      },
      disableWhenUiLocked: true,
    });
  }

  return menuData;
});

// 現在のテンポと拍子を計算
const currentTempo = computed(() => {
  const maybeTempo = props.tempos.findLast((tempo) => {
    return tempo.position <= props.playheadTicks;
  });
  if (!maybeTempo) {
    throw new UnreachableError("assert: At least one tempo exists.");
  }
  return maybeTempo;
});

// 再生ヘッドの位置にある拍子記号
const currentTimeSignature = computed(() => {
  const maybeTimeSignature = props.timeSignatures.findLast((timeSignature) => {
    return timeSignature.measureNumber <= props.currentMeasure;
  });
  if (!maybeTimeSignature) {
    throw new UnreachableError("assert: At least one time signature exists.");
  }
  return maybeTimeSignature;
});

// 再生ヘッドの位置にあるテンポが存在するか
const tempoChangeExists = computed(
  () => currentTempo.value.position === props.playheadTicks,
);

// 再生ヘッドの位置にある拍子記号が存在するか
const timeSignatureChangeExists = computed(
  () => currentTimeSignature.value.measureNumber === props.currentMeasure,
);
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.sequencer-ruler-value-changes-lane {
  height: 24px;
  position: relative;
  overflow: hidden;
  pointer-events: auto;
  isolation: isolate;
}

.sequencer-ruler-value-change {
  font-weight: 700;
  fill: var(--scheme-color-on-surface-variant);

  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

.sequencer-ruler-value-change-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-on-surface-variant);
  stroke-width: 1px;
}
</style>
