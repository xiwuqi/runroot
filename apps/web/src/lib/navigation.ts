export interface FlashMessage {
  readonly text: string;
  readonly tone: "error" | "notice";
}

export type PageSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export async function resolvePageSearchParams(
  searchParams?: Promise<PageSearchParams>,
): Promise<PageSearchParams> {
  return searchParams ? await searchParams : {};
}

export function getFlashMessage(
  searchParams: PageSearchParams,
): FlashMessage | undefined {
  const error = readFirstSearchParam(searchParams.error);

  if (error) {
    return {
      text: error,
      tone: "error",
    };
  }

  const notice = readFirstSearchParam(searchParams.notice);

  if (!notice) {
    return undefined;
  }

  return {
    text: notice,
    tone: "notice",
  };
}

export function buildRedirectUrl(
  requestUrl: string,
  returnTo: FormDataEntryValue | null,
  fallbackPath: string,
): URL {
  const candidate = typeof returnTo === "string" ? returnTo : undefined;
  const nextPath = candidate?.startsWith("/") ? candidate : fallbackPath;

  return new URL(nextPath, requestUrl);
}

export function appendFlashMessage(
  url: URL,
  tone: FlashMessage["tone"],
  text: string,
): void {
  url.searchParams.delete("notice");
  url.searchParams.delete("error");
  url.searchParams.set(tone, text);
}

function readFirstSearchParam(
  value: string | readonly string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return value?.[0];
}
