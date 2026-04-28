import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";

// biome-ignore lint/suspicious/noExplicitAny: SWR fetcher の型は useSWR ジェネリクス側で付ける
export const fetcher = (url: string): Promise<any> =>
	fetch(url).then((r) => r.json());

// fallbackData を必須引数に引き上げることで data が常に非 undefined になるラッパー。
// SWROptions ジェネリクスが SWRConfigurationWithOptionalFallback を通じて逆推論できず
// BlockingData が true に確定しない問題を、return 型の上書きで解消する。
export function useSWRWithFallback<Data>(
	key: string,
	fallbackData: Data,
	config?: Omit<SWRConfiguration<Data>, "fallbackData">,
): Omit<SWRResponse<Data>, "data"> & { data: Data } {
	return useSWR<Data>(key, fetcher, {
		...config,
		fallbackData,
	}) as Omit<SWRResponse<Data>, "data"> & { data: Data };
}
