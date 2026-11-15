/**
 * Tampilan uang dalam Rupiah. Logika game tetap memakai angka kecil
 * (1 poin = Rp1 juta), jadi modal 500 tampil sebagai "Rp500 jt".
 */
export const RUPIAH_PER_POINT = 1_000_000;

const num = (n: number, maxDigits: number) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: maxDigits });

/** Format poin game ke Rupiah ringkas: "Rp150 jt", "Rp1,25 M", "Rp500 rb". */
export function rp(points: number): string {
  const sign = points < 0 ? "-" : "";
  const r = Math.abs(points) * RUPIAH_PER_POINT;
  if (r >= 1e12) return `${sign}Rp${num(r / 1e12, 2)} T`;
  if (r >= 1e9) return `${sign}Rp${num(r / 1e9, 2)} M`;
  if (r >= 1e6) return `${sign}Rp${num(r / 1e6, 1)} jt`;
  if (r >= 1e3) return `${sign}Rp${num(r / 1e3, 0)} rb`;
  return `${sign}Rp${num(r, 0)}`;
}
