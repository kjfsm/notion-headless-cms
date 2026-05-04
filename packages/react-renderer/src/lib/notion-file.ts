// Notion API の file オブジェクト共通形 (external / file の二択) から URL を取り出す。
// image / video / audio / file / pdf の各 block で同じ判別が必要なため集約する。
type NotionFileObject =
  | { type: "external"; external: { url: string } }
  | { type: "file"; file: { url: string } };

export function getFileUrl(file: NotionFileObject): string {
  return file.type === "external" ? file.external.url : file.file.url;
}
