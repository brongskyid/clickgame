# CLICK UPGRADE

Tap, kumpulkan gold, enchant perlengkapan sampai +25. Gagal bisa turun level.
Single-file HTML idle game, tanpa dependensi, jalan langsung di browser HP atau laptop.

## Main

- **Dengan server (Game Hub):** `cd hub && php -S 127.0.0.1:8080 -t public`, buka http://127.0.0.1:8080/ . Login sekali, progres dan skor tersimpan di server.
- **Tanpa server:** buka `hub/public/clickgame/index.html` langsung di browser. Game jalan penuh, progres di perangkat.
- `legacy/click-upgrade.html` adalah versi lama satu file, dipertahankan untuk referensi, tidak dikembangkan lagi.

## Isi repo

| Path | Keterangan |
|---|---|
| `hub/` | Game Hub: portal, SDK `hub.js`, API PHP, dan game dalam `hub/public/clickgame/` (HTML, CSS, config, logika terpisah) |
| `legacy/click-upgrade.html` | Versi lama satu file |
| `CLICK-UPGRADE-MANUAL.md` | Cara bermain dan referensi angka |
| `docs/` | Panduan persiapan server (PDF) |
| `mockups/` | Tiga mockup tampilan awal |

## Fitur

- 6 slot: Weapon + 5 armor (Kepala, Baju, Celana, Tangan, Kaki), masing-masing +0 sampai +25
- Scroll Grade A / Grade B, peluang sukses turun per tier level
- Asuransi 30% harga scroll, atau nekat dan risiko turun level
- Pity system, Level Pack, 3 idle skill dengan milestone, Batu Suci sebagai material langka
- Mode Normal dan Time Attack 30 menit dengan Rebirth
- Leaderboard lokal: Waktu, Gold dipakai, skor Time Attack
- Manual di dalam game (tombol 📖)

Semua angka balance ada di `hub/public/clickgame/config.js`.

---

Dibuat oleh ANDI BINTORO
