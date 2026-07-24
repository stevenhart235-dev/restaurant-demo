type BusinessHoursEntry =
  | Readonly<{
      day: string;
      closed: true;
    }>
  | Readonly<{
      day: string;
      closed: false;
      open: string;
      close: string;
    }>;

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatLabel(value: string): string {
  return value
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatTime(value: string): string {
  const [hourValue, minuteValue] = value.split(":");
  const hour = Number(hourValue);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minuteValue} ${suffix}`;
}

export function formatBusinessHours(entry: BusinessHoursEntry): string {
  if (entry.closed) {
    return "Closed";
  }

  return `${formatTime(entry.open)}–${formatTime(entry.close)}`;
}
