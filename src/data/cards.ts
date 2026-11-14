export type CardEffect =
  | { type: "gain"; amount: number }
  | { type: "pay"; amount: number }
  | { type: "repair"; perLevel: number }
  | { type: "shield" }
  | { type: "goto"; tile: number }
  | { type: "island" }
  | { type: "collectFromAll"; amount: number }
  | { type: "back"; steps: number };

export interface Card {
  id: string;
  title: string;
  text: string;
  icon: string;
  effect: CardEffect;
}

export const CARDS: Card[] = [
  { id: "coinRain", title: "Hujan Koin!", text: "Koin berjatuhan dari langit. Terima 150.", icon: "🪙", effect: { type: "gain", amount: 150 } },
  { id: "harvest", title: "Bonus Panen", text: "Panen jamur melimpah. Terima 100.", icon: "🍄", effect: { type: "gain", amount: 100 } },
  { id: "leakyWallet", title: "Dompet Bolong", text: "Ups! Koinmu jatuh. Bayar 100.", icon: "👛", effect: { type: "pay", amount: 100 } },
  { id: "repair", title: "Tagihan Renovasi", text: "Bayar 20 untuk setiap level bangunan milikmu.", icon: "🔨", effect: { type: "repair", perLevel: 20 } },
  { id: "shield", title: "Perisai Ajaib", text: "Bebas bayar sewa satu kali.", icon: "🛡️", effect: { type: "shield" } },
  { id: "toStart", title: "Terbang ke Mulai", text: "Balon udara membawamu ke petak Mulai.", icon: "🎈", effect: { type: "goto", tile: 0 } },
  { id: "toIsland", title: "Tersesat!", text: "Kamu terdampar di Pulau Terpencil.", icon: "🏝️", effect: { type: "island" } },
  { id: "birthday", title: "Pesta Ulang Tahun", text: "Setiap pemain memberimu 50.", icon: "🎂", effect: { type: "collectFromAll", amount: 50 } },
  { id: "back3", title: "Mundur 3 Langkah", text: "Kamu lupa sesuatu. Mundur 3 petak.", icon: "↩️", effect: { type: "back", steps: 3 } },
  { id: "toFestival", title: "Undangan Festival", text: "Pergi ke Festival Bintang!", icon: "🎉", effect: { type: "goto", tile: 16 } },
];
