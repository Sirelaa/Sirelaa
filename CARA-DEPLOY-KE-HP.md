# Cara Membuat SIRELA Bisa Dipakai Lewat HP (Kamu & Teman-Teman)

Rencananya: **database** dipindah ke MySQL online gratis (Aiven), **server**
dijalankan online gratis (Render), lalu di HP tinggal buka linknya dan
**"Tambah ke Layar Utama"** — jadi kelihatan & kepakai seperti aplikasi,
tanpa install dari Play Store.

Total waktu: sekitar 20-30 menit, semua gratis, tidak perlu kartu kredit.

---

## BAGIAN 1 — Bikin database online (Aiven, gratis selamanya)

1. Buka https://aiven.io lalu **Sign up** (bisa pakai akun Google).
2. Setelah masuk dashboard, klik **Create service**.
3. Pilih **MySQL**.
4. Pilih plan **Free**.
5. Pilih cloud & region bebas (pilih yang **Singapore** kalau ada, biar lebih dekat).
6. Kasih nama terserah, misal `sirela-db`, lalu **Create service**.
7. Tunggu 1-2 menit sampai statusnya jadi **Running** (hijau).
8. Klik service itu, buka tab **Overview** / **Connection information**. Catat:
   - **Host**
   - **Port**
   - **User** (biasanya `avnadmin`)
   - **Password**
   - **Default database** (biasanya `defaultdb`)

   Simpan 5 nilai ini, nanti dipakai di Bagian 2.

> Catatan: kalau nanti pas server pertama kali jalan muncul pesan warning soal
> "Lewati pembuatan database", itu wajar — tinggal pakai nama database yang
> sudah disediakan Aiven (`defaultdb`), bukan bikin baru.

---

## BAGIAN 2 — Upload project ke GitHub

Render butuh kode-nya ada di GitHub dulu.

1. Buka https://github.com, bikin akun kalau belum punya.
2. Klik **New repository**, kasih nama `sirela2`, set **Public** atau **Private**
   bebas, lalu **Create repository**.
3. Paling gampang: di halaman repo itu klik **Add file → Upload files**, lalu
   drag semua isi folder project ini (KECUALI folder `node_modules`, tidak
   perlu diupload) ke situ, lalu **Commit changes**.

   File/folder yang perlu diupload: `server.js`, `db.js`, `db.config.js`,
   `schema.sql`, `package.json`, `package-lock.json`, folder `public/`
   (isinya index.html, style.css, app.js, manifest.json, sw.js, icon-192.png,
   icon-512.png), dan `.gitignore`.

---

## BAGIAN 3 — Deploy server ke Render (gratis)

1. Buka https://render.com, **Sign up** (bisa pakai akun GitHub langsung,
   biar gampang connect).
2. Di dashboard, klik **New → Web Service**.
3. Pilih repo `sirela2` yang tadi diupload.
4. Isi begini:
   - **Name**: `sirela` (atau bebas)
   - **Region**: Singapore kalau ada
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: **Free**
5. Scroll ke bagian **Environment Variables**, tambahkan satu-satu (dari
   catatan Bagian 1):
   | Key | Value |
   |---|---|
   | `DB_HOST` | (host dari Aiven) |
   | `DB_PORT` | (port dari Aiven) |
   | `DB_USER` | (user dari Aiven, misal `avnadmin`) |
   | `DB_PASSWORD` | (password dari Aiven) |
   | `DB_NAME` | `defaultdb` |
   | `DB_SSL` | `true` |
6. Klik **Create Web Service**. Tunggu proses build (2-5 menit).
7. Kalau sukses, Render kasih URL seperti `https://sirela.onrender.com`
   — itu link aplikasinya, bisa dibuka dari HP mana saja.

**Penting (batasan versi gratis Render):** kalau tidak ada yang buka selama
15 menit, server otomatis "tidur". Nanti pas ada yang buka lagi, loading
pertama bisa 30-60 detik (setelah itu normal lagi). Ini wajar untuk versi
gratis dan cukup untuk dipakai bareng teman-teman.

---

## BAGIAN 4 — Install ke HP (jadi kayak aplikasi)

Karena sudah ada `manifest.json` + service worker, tinggal:

**Di Android (Chrome):**
1. Buka link Render (mis. `https://sirela.onrender.com`) di Chrome.
2. Tap menu titik tiga (⋮) di kanan atas → **Add to Home screen** /
   **Tambahkan ke layar Utama** → **Add**.
3. Ikon SIRELA muncul di home screen, buka seperti app biasa (tanpa address
   bar browser).

**Di iPhone (Safari):**
1. Buka link-nya di Safari.
2. Tap ikon **Share** (kotak dengan panah ke atas) → **Add to Home Screen**.
3. Ikon muncul di layar utama.

Bagikan link Render-nya ke teman-teman — mereka tinggal buka & install
dengan cara yang sama di HP masing-masing.

---

## Akun default untuk login pertama kali

- Username: `admin`
- Password: `admin123`

Setelah database jalan pertama kali, tabel & akun contoh ini otomatis dibuat
sendiri (tidak perlu import `schema.sql` manual).

## Kalau ada masalah

- **Error `Access denied` / `ECONNREFUSED`** → cek lagi 5 nilai Environment
  Variables di Render, samakan persis dengan yang di dashboard Aiven.
- **Error SSL** → pastikan `DB_SSL` = `true`.
- **Halaman blank / error 502 saat pertama buka** → tunggu 30-60 detik
  (server lagi "bangun" dari tidur), refresh lagi.
