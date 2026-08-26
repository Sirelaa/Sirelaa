/* =========================================================
   SIRELA — Database Layer (MySQL / MariaDB)
   Versi Tanpa Hash & Salt (Password Teks Biasa)
   ========================================================= */

   const mysql = require("mysql2/promise");
   const crypto = require("node:crypto");
   const config = require("./db.config.js");
   
   let pool;
   
   /* ---------------- Util ---------------- */
   function uid(prefix) {
     return prefix + "_" + crypto.randomBytes(5).toString("hex");
   }
   
   /* ---------------- Setup: buat database + tabel + seed ---------------- */
   async function init() {
     // 1) Konek tanpa nama database dulu, buat database-nya kalau belum ada
     const rootConn = await mysql.createConnection({
       host: config.host,
       port: config.port,
       user: config.user,
       password: config.password,
       ssl: config.ssl
     });
     try {
       await rootConn.query(
         `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
       );
     } catch (e) {
       // Beberapa provider database online (mis. Aiven free tier) tidak mengizinkan
       // membuat database baru dan sudah menyediakan satu database bawaan
       // (biasanya bernama "defaultdb"). Kalau begitu, lewati langkah ini saja —
       // pastikan DB_NAME di environment variable sudah diisi nama database yang tersedia.
       console.warn("Lewati pembuatan database (mungkin tidak diizinkan oleh provider):", e.message);
     }
     await rootConn.end();
   
     // 2) Buat pool koneksi yang sudah terarah ke database sirela_db
     pool = mysql.createPool({
       host: config.host,
       port: config.port,
       user: config.user,
       password: config.password,
       database: config.database,
       ssl: config.ssl,
       waitForConnections: true,
       connectionLimit: 10
     });
   
     // 3) Buat tabel-tabel kalau belum ada (kolom password_hash & salt diganti menjadi password)
     await pool.query(`
       CREATE TABLE IF NOT EXISTS users (
         id         VARCHAR(40) PRIMARY KEY,
         name       VARCHAR(150) NOT NULL,
         username   VARCHAR(100) NOT NULL UNIQUE,
         email      VARCHAR(150),
         password   VARCHAR(255) NOT NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
     `);
     await pool.query(`
       CREATE TABLE IF NOT EXISTS sessions (
         token      VARCHAR(64) PRIMARY KEY,
         user_id    VARCHAR(40) NOT NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
     `);
     await pool.query(`
       CREATE TABLE IF NOT EXISTS jurusan (
         id   VARCHAR(40) PRIMARY KEY,
         nama VARCHAR(150) NOT NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
     `);
     await pool.query(`
       CREATE TABLE IF NOT EXISTS rooms (
         id         VARCHAR(40) PRIMARY KEY,
         nama       VARCHAR(150) NOT NULL,
         status     VARCHAR(20) NOT NULL DEFAULT 'Kosong',
         kelas      VARCHAR(100) DEFAULT '',
         jurusan_id VARCHAR(40) DEFAULT ''
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
     `);
     await pool.query(`
       CREATE TABLE IF NOT EXISTS schedules (
         id       VARCHAR(40) PRIMARY KEY,
         room_id  VARCHAR(40) NOT NULL,
         day      VARCHAR(10) NOT NULL,
         start    VARCHAR(10) NOT NULL,
         end_time VARCHAR(10) NOT NULL,
         subject  VARCHAR(150),
         teacher  VARCHAR(150),
         color    VARCHAR(20)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
     `);
     await pool.query(`
       CREATE TABLE IF NOT EXISTS kelas_list (
         id   INT AUTO_INCREMENT PRIMARY KEY,
         nama VARCHAR(100) NOT NULL UNIQUE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
     `);
     await pool.query(`
       CREATE TABLE IF NOT EXISTS app_settings (
         id           INT PRIMARY KEY,
         notifikasi   TINYINT(1) DEFAULT 1,
         mode_gelap   TINYINT(1) DEFAULT 0,
         bahasa       VARCHAR(30) DEFAULT 'Indonesia',
         tahun_ajaran VARCHAR(20) DEFAULT '2025/2026'
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
     `);
   
     await seedIfEmpty();
     await pool.query(
       `INSERT IGNORE INTO app_settings (id, notifikasi, mode_gelap, bahasa, tahun_ajaran) VALUES (1,1,0,'Indonesia','2025/2026')`
     );
   }
   
   async function seedIfEmpty() {
     const [[{ c }]] = await pool.query("SELECT COUNT(*) AS c FROM users");
     if (c > 0) return;
   
     // Akun default dengan password teks biasa "admin123"
     await pool.query(
       `INSERT INTO users (id, name, username, email, password) VALUES (?,?,?,?,?)`,
       [uid("u"), "Admin SIRELA", "admin", "admin@sekolah.sch.id", "admin123"]
     );
   
     const jurusanSeed = [
       ["j1", "Akuntansi"],
       ["j2", "RPL"],
       ["j3", "IPA"],
       ["j4", "IPS"]
     ];
     for (const [id, nama] of jurusanSeed) {
       await pool.query("INSERT INTO jurusan (id, nama) VALUES (?,?)", [id, nama]);
     }
   
     const roomsSeed = [
       ["r1", "Ruang 101", "Terpakai", "X-RPL-1", "j2"],
       ["r2", "Ruang 102", "Kosong", "", ""],
       ["r3", "Ruang 103", "Terpakai", "XI-AKL-2", "j1"],
       ["r4", "Ruang 104", "Kosong", "", ""]
     ];
     for (const r of roomsSeed) {
       await pool.query(
         "INSERT INTO rooms (id, nama, status, kelas, jurusan_id) VALUES (?,?,?,?,?)",
         r
       );
     }
   
     const schedSeed = [
       ["s1", "r1", "Sen", "07:00", "08:30", "Matematika XI", "Dr. Sarah Collins", "#2A5FCE"],
       ["s2", "r2", "Sen", "08:30", "10:00", "Fisika XI", "Mr. James Smith", "#1E6B44"],
       ["s3", "r3", "Sen", "10:15", "11:45", "Sastra Inggris", "Mrs. Diana Walsh", "#E38B29"],
       ["s4", "r1", "Sen", "13:00", "14:30", "Biologi XI", "Dr. Emily Brown", "#A32D2D"]
     ];
     for (const s of schedSeed) {
       await pool.query(
         "INSERT INTO schedules (id, room_id, day, start, end_time, subject, teacher, color) VALUES (?,?,?,?,?,?,?,?)",
         s
       );
     }
   
     const kelasSeed = ["X-RPL-1", "XI-AKL-2", "XI-IPA-1", "XI-IPS-2"];
     for (const k of kelasSeed) {
       await pool.query("INSERT IGNORE INTO kelas_list (nama) VALUES (?)", [k]);
     }
   
     await pool.query(
       `INSERT INTO app_settings (id, notifikasi, mode_gelap, bahasa, tahun_ajaran) VALUES (1,1,0,'Indonesia','2025/2026')`
     );
   }
   
   /* =========================================================
      API Data Access
      ========================================================= */
   
   /* ----- Users & Auth ----- */
   async function findUserByUsername(username) {
     const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
     return rows[0] || null;
   }
   async function findUserById(id) {
     const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
     return rows[0] || null;
   }
   async function createUser({ name, username, email, password }) {
     const id = uid("u");
     await pool.query(
       `INSERT INTO users (id, name, username, email, password) VALUES (?,?,?,?,?)`,
       [id, name, username, email, password]
     );
     return findUserById(id);
   }
   async function updateUserPassword(userId, newPassword) {
     await pool.query("UPDATE users SET password = ? WHERE id = ?", [
       newPassword,
       userId
     ]);
   }
   async function createSession(userId) {
     const token = crypto.randomBytes(24).toString("hex");
     await pool.query("INSERT INTO sessions (token, user_id) VALUES (?,?)", [token, userId]);
     return token;
   }
   async function getUserBySession(token) {
     if (!token) return null;
     const [rows] = await pool.query(
       `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
       [token]
     );
     return rows[0] || null;
   }
   async function deleteSession(token) {
     await pool.query("DELETE FROM sessions WHERE token = ?", [token]);
   }
   function publicUser(u) {
     if (!u) return null;
     return { id: u.id, name: u.name, username: u.username, email: u.email };
   }
   
   /* ----- Settings ----- */
   async function getSettings() {
     const [rows] = await pool.query("SELECT * FROM app_settings WHERE id = 1");
     const row = rows[0];
     return {
       notifikasi: !!row.notifikasi,
       modeGelap: !!row.mode_gelap,
       bahasa: row.bahasa,
       tahunAjaran: row.tahun_ajaran
     };
   }
   async function updateSettings(patch) {
     const cur = await getSettings();
     const next = { ...cur, ...patch };
     await pool.query(
       `UPDATE app_settings SET notifikasi=?, mode_gelap=?, bahasa=?, tahun_ajaran=? WHERE id=1`,
       [next.notifikasi ? 1 : 0, next.modeGelap ? 1 : 0, next.bahasa, next.tahunAjaran]
     );
     return getSettings();
   }
   
   /* ----- Jurusan ----- */
   async function listJurusan() {
     const [rows] = await pool.query("SELECT * FROM jurusan ORDER BY id");
     return rows;
   }
   async function createJurusan(nama) {
     const id = uid("j");
     await pool.query("INSERT INTO jurusan (id, nama) VALUES (?,?)", [id, nama]);
     return { id, nama };
   }
   async function deleteJurusan(id) {
     await pool.query("DELETE FROM jurusan WHERE id = ?", [id]);
     await pool.query("UPDATE rooms SET jurusan_id = '' WHERE jurusan_id = ?", [id]);
   }
   
   /* ----- Rooms ----- */
   function mapRoom(r) {
     return { id: r.id, nama: r.nama, status: r.status, kelas: r.kelas, jurusanId: r.jurusan_id };
   }
   async function listRooms() {
     const [rows] = await pool.query("SELECT * FROM rooms ORDER BY id");
     return rows.map(mapRoom);
   }
   async function getRoom(id) {
     const [rows] = await pool.query("SELECT * FROM rooms WHERE id = ?", [id]);
     return rows[0] ? mapRoom(rows[0]) : null;
   }
   async function createRoom({ nama, status, kelas, jurusanId }) {
     const id = uid("r");
     await pool.query(
       "INSERT INTO rooms (id, nama, status, kelas, jurusan_id) VALUES (?,?,?,?,?)",
       [id, nama, status || "Kosong", kelas || "", jurusanId || ""]
     );
     return getRoom(id);
   }
   async function updateRoom(id, patch) {
     const cur = await getRoom(id);
     if (!cur) return null;
     const next = { ...cur, ...patch };
     await pool.query(
       "UPDATE rooms SET nama=?, status=?, kelas=?, jurusan_id=? WHERE id=?",
       [next.nama, next.status, next.kelas, next.jurusanId, id]
     );
     return getRoom(id);
   }
   
   /* ----- Schedules ----- */
   function mapSched(s) {
     return {
       id: s.id,
       roomId: s.room_id,
       day: s.day,
       start: s.start,
       end: s.end_time,
       subject: s.subject,
       teacher: s.teacher,
       color: s.color
     };
   }
   async function listSchedules() {
     const [rows] = await pool.query("SELECT * FROM schedules ORDER BY id");
     return rows.map(mapSched);
   }
   async function getSchedule(id) {
     const [rows] = await pool.query("SELECT * FROM schedules WHERE id = ?", [id]);
     return rows[0] ? mapSched(rows[0]) : null;
   }
   async function createSchedule({ roomId, day, start, end, subject, teacher, color }) {
     const id = uid("s");
     await pool.query(
       "INSERT INTO schedules (id, room_id, day, start, end_time, subject, teacher, color) VALUES (?,?,?,?,?,?,?,?)",
       [id, roomId, day, start, end, subject || "", teacher || "", color || "#2A5FCE"]
     );
     return getSchedule(id);
   }
   async function updateSchedule(id, patch) {
     const cur = await getSchedule(id);
     if (!cur) return null;
     const next = { ...cur, ...patch };
     await pool.query(
       "UPDATE schedules SET room_id=?, day=?, start=?, end_time=?, subject=?, teacher=?, color=? WHERE id=?",
       [next.roomId, next.day, next.start, next.end, next.subject, next.teacher, next.color, id]
     );
     return getSchedule(id);
   }
   async function deleteSchedulesByRoom(roomId) {
     await pool.query("DELETE FROM schedules WHERE room_id = ?", [roomId]);
   }
   async function deleteRoom(id) {
     await pool.query("DELETE FROM rooms WHERE id = ?", [id]);
   }
   async function deleteSchedule(id) {
     await pool.query("DELETE FROM schedules WHERE id = ?", [id]);
   }
   
   /* ----- Kelas List ----- */
   async function listKelas() {
     const [rows] = await pool.query("SELECT nama FROM kelas_list ORDER BY id");
     return rows.map((r) => r.nama);
   }
   async function addKelas(nama) {
     await pool.query("INSERT IGNORE INTO kelas_list (nama) VALUES (?)", [nama]);
     return listKelas();
   }
   async function deleteKelas(nama) {
     await pool.query("DELETE FROM kelas_list WHERE nama = ?", [nama]);
     return listKelas();
   }
   
   module.exports = {
     init,
     findUserByUsername,
     findUserById,
     createUser,
     updateUserPassword,
     createSession,
     getUserBySession,
     deleteSession,
     publicUser,
     getSettings,
     updateSettings,
     listJurusan,
     createJurusan,
     deleteJurusan,
     listRooms,
     getRoom,
     createRoom,
     updateRoom,
     listSchedules,
     getSchedule,
     createSchedule,
     updateSchedule,
     deleteSchedule,
     deleteSchedulesByRoom,
     deleteRoom,
     listKelas,
     addKelas,
     deleteKelas
   };