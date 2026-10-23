export class AppError extends Error {
  constructor(message: string, public status = 400, public code = "INVALID_INPUT") { super(message); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("ساختار درخواست معتبر نیست.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new AppError("متن خالی یا بیش از حد طولانی است.");
  return value.trim();
}
export function identifier(value: unknown, prefix: string): string {
  const id = text(value, 100);
  if (!new RegExp(`^${prefix}_[a-zA-Z0-9-]+$`).test(id)) throw new AppError("شناسه معتبر نیست.");
  return id;
}
export function finiteNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new AppError("مقدار عددی خارج از محدوده است.");
  return value;
}
export function money(value: unknown): number {
  const n = finiteNumber(value, 1, 100_000_000_000_000);
  if (!Number.isSafeInteger(n)) throw new AppError("مبلغ باید به تومان و عدد صحیح باشد.");
  return n;
}
