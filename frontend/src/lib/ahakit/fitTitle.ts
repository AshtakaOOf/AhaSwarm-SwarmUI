
const EXT = /\.(safetensors|ckpt|gguf|sft|pt|pth|bin|onnx|engine|json|yaml|yml|png|jpe?g|webp|gif|avif|mp4|webm|mov)$/i;

export function cleanTitle(name: string): string {
  return name.replace(EXT, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.\-]+|[\s.\-]+$/g, '').trim() || name;
}

// splits text into chunks a line may break between (rendered with <wbr>): after - / +, after
export function breakParts(text: string): string[] {
  return text.split(/(?<=[\-/+])(?=\S)|(?<=\.)(?=[^\s\d])|(?<=[a-z\d])(?=[A-Z])/);
}

export interface FitOptions {
  width: number;
  lines?: number;
  sizes?: number[];
  glyph?: number;
}

export interface FitResult {
  text: string;
  size: number;
  cut: boolean;
}

export function middleEllipsis(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const budget = Math.max(4, max - 1);
  const words = text.split(' ');
  const parts = breakParts(text);
  const lastWord = words.length > 1 ? words[words.length - 1] : parts[parts.length - 1];
  const tailLen = lastWord.length <= budget * 0.5 ? Math.max(lastWord.length, Math.round(budget * 0.3)) : Math.round(budget * 0.4);
  const tail = text.slice(text.length - tailLen).trimStart();
  return `${text.slice(0, budget - tail.length).trimEnd()}…${tail}`;
}

export function fitTitle(text: string, { width, lines = 2, sizes = [12, 11, 10], glyph = 0.56 }: FitOptions): FitResult {
  // wrapping wastes part of each line (words don't break mid-way), so lines are counted at ~85% full
  const capacity = (size: number) => Math.max(1, Math.floor((width / (size * glyph)) * (lines > 1 ? lines * 0.85 : 0.95)));
  for (const size of sizes) {
    if (text.length <= capacity(size)) {
      return { text, size, cut: false };
    }
  }
  const size = sizes[sizes.length - 1];
  return { text: middleEllipsis(text, capacity(size)), size, cut: true };
}
