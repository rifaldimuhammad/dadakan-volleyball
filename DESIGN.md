# DESIGN.md — Dadakan Volleyball

Arah desain untuk aplikasi Dadakan Volleyball. File ini adalah **sumber arah** (identity, warna, tipografi, mood). `antislop.md` adalah filternya. Keduanya kerja bareng: antislop membuang yang generik, DESIGN.md mengisi arahnya.

Referensi mood diambil dari flite.bike (produk cockpit sepeda premium). Yang diambil: **kehangatan kanvas, satu aksen berani, dan tampilan data bergaya telemetri**. Yang TIDAK diambil: layout, produk, atau identity-nya. Ini aplikasi volleyball, bukan tiruan FLITE (antislop R-30).

---

## 1. Identity

- **Produk:** aplikasi web untuk mengatur jadwal main voli dadakan, pendaftaran pemain, pembagian tim, posisi (toser/pemukul), dan pembayaran (DP).
- **Audiens:** pemain voli amatir Indonesia yang daftar lewat HP, cepat, sering sambil buru-buru sebelum jadwal main.
- **Karakter:** **sporty, cepat, jujur, hangat.** Bukan korporat, bukan "tech startup". Terasa seperti papan skor lapangan yang rapi, bukan dashboard SaaS.
- **Uji identitas (antislop R-20):** kalau logo & nama diganti, desain ini harus tetap terasa "aplikasi lapangan voli", bukan landing page produk apa pun.

## 2. Dials (antislop Part 3)

> Reading this as: aplikasi utilitas-sporty untuk pemain voli amatir di HP, bahasa visual "papan skor hangat", dial **ENERGY 2 / RHYTHM 2 / MOTION 2**.

- **ENERGY 2 (Balanced):** percaya diri dan sporty, tapi tidak teriak. Satu aksen energik, bukan pelangi.
- **RHYTHM 2 (consistent, few breaks):** sebagian besar kartu konsisten, tapi hero jadwal & kartu tim boleh pecah ritme. Hindari semua section identik.
- **MOTION 2 (scroll-reveal + transition):** gerak hanya saat membawa makna — status pemain berubah, sheet naik, skor masuk. Hormati `prefers-reduced-motion`.

## 3. Palette

Kanvas hangat ala flite diadaptasi: ganti blue-grey dingin lama (`#f4f5fb`) dengan **off-white hangat** supaya aplikasi terasa "lapangan sore", bukan "layar admin". Aksen tetap keluarga `court` biru yang sudah ada supaya tidak membuang kerja v2, ditambah oranye `sun` sebagai aksen energi tunggal.

Batas: **2–3 warna inti + 1 aksen** (antislop R-29). Netral (hitam/putih/abu) tidak dihitung.

| Peran | Nilai | Catatan |
|---|---|---|
| **Canvas** (latar utama) | `#FBFAF4` | off-white hangat, pengganti `#f4f5fb`. Jiwa dari flite `rgb(255,252,239)`, diturunkan sedikit agar netral |
| **Surface** (kartu) | `#FFFFFF` | kartu & sheet |
| **Surface muted** | `#F3F1E9` | blok selang-seling, skeleton |
| **Ink** (teks utama) | `#14151A` | near-black hangat (flite `#0e0e0e`), bukan hitam murni |
| **Ink soft** | `#3A3D4A` | teks sekunder |
| **Ink muted** | `#75798C` | caption, placeholder |
| **Border** | `#E6E2D6` | garis halus di atas kanvas hangat |
| **Court** (aksen inti) | `#2B4FF0` (600) / `#3B63FF` (500) / `#1F3BD4` (700) | biru voli — CTA, link, fokus. Dipertahankan dari v2 |
| **Sun** (aksen energi) | `#FF9D1C` (500) / `#FFB43B` (400) | HANYA untuk momen kunci: tombol daftar utama, highlight "slot terakhir", skor. Jangan ditebar |
| **Toser** (semantik posisi) | `#2B4FF0` | pakai court — peran strategis |
| **Pemukul** (semantik posisi) | `#FF9D1C` | pakai sun — peran agresif |
| **Status: lunas** | `#16A34A` | hijau |
| **Status: DP** | `#FF9D1C` | sun |
| **Status: belum bayar** | `#DC2626` | merah, hanya untuk status nyata |

**Larangan warna (antislop R-01):** tidak ada gradient biru→ungu default, tidak ada glow background seluruh halaman, tidak ada palet neon. Gradient hanya boleh kalau memisahkan hierarki dan alasannya ditulis.

## 4. Typography

flite memakai PP Neue Montreal + Fragment Mono. Kita tidak beli font berbayar; adaptasinya memakai padanan gratis yang karakternya mirip, dan **mono untuk angka** adalah motif identitas yang diwarisi dari flite.

| Peran | Font | Alasan (antislop R-06, R-31) |
|---|---|---|
| **Display** (judul, nama tim, hero) | `Clash Display` | grotesk tegas, padanan gratis PP Neue Montreal. Sudah ada di config |
| **Body / UI** | `Plus Jakarta Sans` | terbaca di HP, ramah, sudah dipakai v2 |
| **Mono (angka & data)** | `Space Mono` atau `JetBrains Mono` | **motif telemetri dari flite** — skor, jumlah slot (`6/12`), nomor pemain, countdown DP, harga. Angka pakai mono = terasa seperti papan skor |

Skala (diadaptasi dari skala flite 11→52px):

- Caption `11px` · Label `13px` · Body `15–16px` · Lead `18px`
- Heading `22 / 28 / 36px` · Hero display `44–52px`
- **Angka data** selalu mono + `tabular-nums` biar tidak geser saat berubah.

## 5. Spacing, Radius, Shadow

- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 (gunakan whitespace sebagai struktur, bukan sisa — antislop Levers). Jangan ritme spacing seragam di semua section.
- **Radius (adaptasi flite 999 / 40 / 20 / 12–18):**
  - Pill `999px` → chip status, badge posisi
  - Kartu besar `28px` (`rounded-3xl`, sudah ada) → kartu tim, sheet
  - Kartu/tombol `20px` (`rounded-2xl`) → tombol, input
  - Kecil `12px` → chip kecil, tag
  - **Jangan** semua elemen pill (antislop R-11). Variasi radius = alat hierarki.
- **Shadow (pakai yang sudah ada):** `soft` untuk kartu, `lift` untuk elemen terangkat, `glow` HANYA untuk CTA utama. Bukan setiap elemen melayang (antislop R-12).

## 6. Motion (MOTION 2)

Pakai keyframes yang sudah ada, dengan tujuan tertulis (antislop R-19):

- `fade-up` → entri kartu daftar (membimbing baca dari atas)
- `sheet-up` → bottom sheet form daftar/edit di HP
- `scale-in` / `pop` → feedback saat status pemain berubah (DP masuk, slot terisi)
- `shimmer` → skeleton loading (bukan dekorasi)

Larangan: tidak semua elemen Fade+Float+Scale+Bounce bersamaan. Semua gerak berhenti pada `prefers-reduced-motion`.

## 7. Identity Motif

Satu gerakan/pola spesifik yang diulang agar desain "milik" Dadakan Volleyball:

- **Angka bergaya papan skor:** semua angka penting (slot `6/12`, skor, countdown DP, harga) pakai font mono + tabular-nums, dalam kotak kecil bergaris. Ini warisan telemetri flite yang diterjemahkan ke konteks voli.
- **Dua warna peran:** biru (toser) vs oranye (pemukul) dipakai konsisten di badge, chip, dan ikon posisi — langsung terbaca siapa main di mana.

## 8. Yang WAJIB dihindari (ringkasan Hard Gate antislop)

- Statistik/angka palsu (R-17): jumlah pemain, slot, harga — semua dari data Supabase nyata, bukan hiasan.
- Testimoni palsu, logo "trusted by" karangan (R-18, R-36).
- Nav ke halaman yang tidak ada (R-24). Tombol yang tidak melakukan apa-apa (R-26).
- Em dash `—` di teks UI (R-02) — pakai koma, titik, titik dua, atau tanda kurung.
- Kontras teks di bawah WCAG AA (R-25) — cek teks di atas kanvas hangat & di atas warna aksen.
- Harus ada empty / loading / error state di setiap tampilan data (R-27).

## 9. Catatan integrasi

- Ganti `canvas: '#f4f5fb'` di `tailwind.config.js` → `#FBFAF4`, dan `ink.DEFAULT` → `#14151A` kalau mau menerapkan arah hangat ini. Keluarga `court` & `sun` tetap.
- Tambah `font-mono: ['Space Mono', 'ui-monospace', 'monospace']` di `fontFamily` untuk motif angka.
- Terapkan bertahap (preview dulu, sesuai preferensi staging-first), jangan rombak serentak.
