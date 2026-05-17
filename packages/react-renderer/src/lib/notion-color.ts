// Notion の color トークン（"default" | "<color>" | "<color>_background"）を
// Tailwind class へ変換する単一の表。rich_text の Annotation も block も同じ表を参照する。

export type NotionColor = string;

const FG: Record<string, string> = {
  gray: "text-gray-500",
  brown: "text-amber-800",
  orange: "text-orange-500",
  yellow: "text-yellow-600",
  green: "text-green-600",
  blue: "text-blue-600",
  purple: "text-purple-600",
  pink: "text-pink-600",
  red: "text-red-600",
};

const BG: Record<string, string> = {
  gray_background: "bg-gray-100",
  brown_background: "bg-amber-100",
  orange_background: "bg-orange-100",
  yellow_background: "bg-yellow-100",
  green_background: "bg-green-100",
  blue_background: "bg-blue-100",
  purple_background: "bg-purple-100",
  pink_background: "bg-pink-100",
  red_background: "bg-red-100",
};

const isDefault = (c: NotionColor | undefined): boolean =>
  !c || c === "default";

/** rich_text の annotation 用。inline span の class を返す。背景時は rounded + 横 padding を付ける。 */
export function notionInlineColorClass(color: NotionColor | undefined): string {
  if (isDefault(color)) return "";
  if (color?.endsWith("_background")) {
    const bg = BG[color];
    return bg ? `${bg} rounded px-1` : "";
  }
  return FG[color as string] ?? "";
}

/** block コンテナ用。背景時はブロック全体に背景を伸ばすため横 padding を厚めに付ける。 */
export function notionBlockColorClass(color: NotionColor | undefined): string {
  if (isDefault(color)) return "";
  if (color?.endsWith("_background")) {
    const bg = BG[color];
    return bg ? `${bg} rounded px-3 py-2` : "";
  }
  return FG[color as string] ?? "";
}
