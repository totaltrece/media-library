<template>
  <ColorPicker
    :pure-color="modelValue"
    disable-alpha
    disable-history
    format="hex"
    picker-type="chrome"
    shape="circle"
    use-type="pure"
    :z-index="200"
    @update:pure-color="onColorChange"
  />
</template>

<script setup lang="ts">
import { ColorPicker } from "vue3-colorpicker";
import "vue3-colorpicker/style.css";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [color: string];
}>();

function onColorChange(color: unknown): void {
  const hex = toHexColor(color);

  if (hex !== null && hex !== props.modelValue) {
    emit("update:modelValue", hex);
  }
}

function toHexColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const hex = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);

  if (hex !== null && hex[1] !== undefined) {
    return `#${hex[1].toLowerCase()}`;
  }

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(trimmed);

  if (rgb === null || rgb[1] === undefined || rgb[2] === undefined || rgb[3] === undefined) {
    return null;
  }

  const red = Number(rgb[1]).toString(16).padStart(2, "0");
  const green = Number(rgb[2]).toString(16).padStart(2, "0");
  const blue = Number(rgb[3]).toString(16).padStart(2, "0");
  return `#${red}${green}${blue}`;
}
</script>
