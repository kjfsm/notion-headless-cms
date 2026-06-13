type NotionFileObject =
  | { type: "external"; external: { url: string } }
  | { type: "file"; file: { url: string } };

export function getFileUrl(file: NotionFileObject): string {
  return file.type === "external" ? file.external.url : file.file.url;
}
