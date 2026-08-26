# SIRELA — dengan Database MySQL/MariaDB (kelihatan di phpMyAdmin)

Versi ini pakai **MySQL/MariaDB** — database yang sama jenisnya dengan yang lain-lain
di phpMyAdmin Anda. Jadi setelah dijalankan, database `sirela_db` akan **muncul di
daftar database phpMyAdmin**, persis seperti `sekolah`, `kantin_sekolah`, dll.

## Yang Anda butuhkan

1. **MySQL/MariaDB sudah jalan** (XAMPP/Laragon Anda yang sekarang — sudah jalan, terbukti
   dari phpMyAdmin yang tadi kebuka)
2. **Node.js** versi 18 ke atas (`node --version`)

## Cara menjalankan

1. Extract folder ini, buka terminal/PowerShell di dalamnya
2. Install 1 package yang dibutuhkan (cuma sekali saja):
   ```
   npm install
   ```
3. Jalankan server:
   ```
   node server.js
   ```
4. Kalau berhasil, akan muncul:
   ```
   Menghubungkan ke MySQL/MariaDB...
   Database siap (nama database: sirela_db, cek di phpMyAdmin).
   SIRELA server jalan di http://localhost:3000
   ```
5. Buka browser ke **http://localhost:3000**

Setelah itu, buka phpMyAdmin Anda (`http://localhost/phpmyadmin`) → refresh panel kiri →
akan ada database baru bernama **`sirela_db`**, isinya 7 tabel: `users`, `sessions`,
`jurusan`, `rooms`, `schedules`, `kelas_list`, `app_settings`.

## Akun default

- **Username:** `admin`
- **Password:** `admin123`

## Kalau MySQL Anda pakai password

Defaultnya kode ini asumsi MySQL Anda seperti XAMPP/Laragon standar: user `root`,
password kosong. Kalau MySQL Anda pakai password, edit file **`db.config.js`**:

```js
module.exports = {
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "password_mysql_anda",   // <-- isi di sini
  database: "sirela_db"
};
```

## Struktur folder

```
├── server.js       ← jalankan file ini
├── db.js           ← koneksi & fungsi-fungsi database MySQL
├── db.config.js    ← pengaturan koneksi (host/user/password), edit kalau perlu
├── schema.sql       ← skema tabel (referensi, bisa juga diimport manual lewat phpMyAdmin)
├── package.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js        ← frontend, manggil /api/* lewat fetch()
```

## Catatan penting

- **Tabel & data contoh dibuat OTOMATIS** saat pertama kali `node server.js` dijalankan —
  Anda tidak perlu import `schema.sql` manual. File itu cuma dokumentasi/cadangan kalau mau
  bikin manual lewat phpMyAdmin.
- Password user disimpan ter-hash (scrypt + salt), bukan plaintext.
- Kalau mau reset semua data: buka phpMyAdmin → hapus database `sirela_db` → jalankan
  `node server.js` lagi, akan dibuat ulang otomatis beserta data contoh.
- Kalau muncul error `Access denied for user 'root'@...` atau `ECONNREFUSED`, itu tandanya
  MySQL/MariaDB belum jalan, atau setting di `db.config.js` belum cocok dengan punya Anda.
