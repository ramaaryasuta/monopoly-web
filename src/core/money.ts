/**
 * Tampilan uang dalam Rupiah. Logika game tetap memakai angka kecil
 * (1 poin = Rp1 juta), jadi modal 500 tampil sebagai "Rp500 jt".
 */
import { Lang } from "../lang/id";

export const RUPIAH_PER_POINT = 1_000_000;

const num = (n: number, maxDigits: number) =>
  n.toLocaleString(Lang.money.locale, { maximumFractionDigits: maxDigits });

/** Format poin game ke Rupiah ringkas: "Rp150 jt", "Rp1,25 M", "Rp500 rb". */
export function rp(points: number): string {
  const sign = points < 0 ? "-" : "";
  const r = Math.abs(points) * RUPIAH_PER_POINT;
  if (r >= 1e12) return `${sign}${Lang.money.prefix}${num(r / 1e12, 2)}${Lang.money.trillion}`;
  if (r >= 1e9) return `${sign}${Lang.money.prefix}${num(r / 1e9, 2)}${Lang.money.billion}`;
  if (r >= 1e6) return `${sign}${Lang.money.prefix}${num(r / 1e6, 1)}${Lang.money.million}`;
  if (r >= 1e3) return `${sign}${Lang.money.prefix}${num(r / 1e3, 0)}${Lang.money.thousand}`;
  return `${sign}${Lang.money.prefix}${num(r, 0)}`;
}
