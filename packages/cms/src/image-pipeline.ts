export interface ImageVariantRequest {
  readonly hash: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface ImageVariantResult {
  readonly hash: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly contentType: string;
}

/**
 * 画像処理の拡張点。既定実装は width/height のヘッダパースのみ（#437 ADR-7:
 * variant 生成はしない — リサイズは有料機能 or 重い wasm が必要なため）。
 * 将来 Image Transformations 等を足したい利用者のための差し込み口として残す。
 */
export interface ImagePipeline {
  process(req: ImageVariantRequest): Promise<ImageVariantResult>;
}
