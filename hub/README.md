# Game Hub

Satu login untuk semua game HTML. Backend PHP 8.3 + SQLite, tanpa framework. Client tetap HTML/CSS/JS.

## Struktur

```
hub/
  public/                 root web
    index.html            portal: daftar game + login
    hub.js                SDK bersama (Hub.login, Hub.save, Hub.score, Hub.board, Hub.ui.login)
    api/                  PHP
      _bootstrap.php      koneksi SQLite, sesi cookie, rate limit, helper
      auth.php            GET: siapa saya · POST: register | login | guest | upgrade | rename | logout
      save.php            GET ?game= · POST {game, data}
      score.php           POST {game, board, value, meta}
      board.php           GET ?game=&board=&limit=   (skor terbaik tiap pemain)
      ping.php
    clickgame/            index.html · style.css · config.js · game.js
  data/                   DI LUAR root web, dibuat otomatis: hub.sqlite (gitignored)
  schema.sql
  Caddyfile.example
```

## Jalankan lokal

```bash
cd hub
php -S 127.0.0.1:8080 -t public
```

Buka http://127.0.0.1:8080/ . Database dibuat otomatis di `hub/data/hub.sqlite` saat request pertama.
Lokasi data bisa diganti dengan variabel lingkungan `HUB_DATA_DIR`.

## Deploy ke VPS

Ikuti `docs/Persiapan-Server-Game-Hub.pdf`. Ringkasnya: salin folder `hub/` ke `/var/www/hub`,
pasang `Caddyfile.example` sebagai `/etc/caddy/Caddyfile`, pastikan `data/` dimiliki `www-data`.

## Menambah game baru

1. Daftarkan di `HUB_GAMES` pada `api/_bootstrap.php`: id game dan papan skornya (`asc` = nilai kecil lebih baik).
2. Buat folder `public/<id>/`, sertakan `<script src="../hub.js"></script>`.
3. Di game: `await Hub.me()`, `Hub.load(id)`, `Hub.save(id, data)`, `Hub.score(id, board, value, meta)`, `Hub.board(id, board)`.
4. Tambahkan kartu di `public/index.html`.

## Keamanan yang sudah ada

- Password: `password_hash` (bcrypt/argon sesuai PHP), tidak pernah disimpan mentah.
- Sesi: token acak 32 byte, disimpan sebagai SHA-256, cookie HttpOnly + SameSite=Lax (+ Secure di HTTPS), 90 hari.
- Semua POST wajib header `X-Requested-With: hub` (menolak form lintas situs). Semua kueri prepared statements.
- Rate limit: login 20/10 menit per IP, daftar dan tamu 10/jam per IP, skor 60/jam per akun.
- Batas ukuran save 64 KB, meta skor 1 KB. Database di luar root web.

Belum ada (Fase 2): validasi skor di server, dadu enchant di server, daily seed.
