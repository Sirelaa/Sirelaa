/* =========================================================
   SIRELA — Konfigurasi Koneksi Database MySQL/MariaDB
   Kalau setup MySQL Anda beda (misal ada password, port beda,
   atau nama database mau diganti), edit nilai-nilai di bawah ini.

   Default di bawah cocok untuk XAMPP/Laragon standar:
   host: 127.0.0.1, user: root, password: '' (kosong), port: 3306
   ========================================================= */

module.exports = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sirela_db",
  // Set DB_SSL=true di environment variable kalau database online (mis. Aiven)
  // mewajibkan koneksi SSL. Untuk XAMPP/Laragon di localhost, biarkan kosong/false.
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
};
