const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export function formatFileSize(
  bytes?: number,
  options: { decimals?: number; fallback?: string } = {},
): string {
  const { decimals = 1, fallback = "-" } = options;
  if (bytes === undefined || !Number.isFinite(bytes)) return fallback;
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(decimals)} ${UNITS[unit]}`;
}

const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

// `Intl.DateTimeFormat` construction costs ~1ms; lists render thousands of dates.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(
  locale: string | undefined,
  format: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${JSON.stringify(format)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, format);
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatDate(
  epochMs?: number,
  options: {
    locale?: string;
    format?: Intl.DateTimeFormatOptions;
    fallback?: string;
  } = {},
): string {
  const { locale, format = DEFAULT_DATE_FORMAT, fallback = "-" } = options;
  if (epochMs === undefined || !Number.isFinite(epochMs)) return fallback;
  return formatterFor(locale, format).format(new Date(epochMs));
}
