-- =========================================================
-- SIRELA — Skema Database (MySQL / MariaDB)
-- Bisa diimport manual lewat phpMyAdmin (tab "Impor"),
-- TAPI tidak wajib — server (db.js) akan membuatnya otomatis
-- saat pertama kali dijalankan kalau belum ada.
-- =========================================================

CREATE DATABASE IF NOT EXISTS sirela_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE sirela_db;

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(40) PRIMARY KEY,
  NAME          VARCHAR(150) NOT NULL,
  username      VARCHAR(100) NOT NULL UNIQUE,
  email         VARCHAR(150),
  password_hash VARCHAR(255) NOT NULL,
  salt          VARCHAR(64) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4;

-- Sesi login aktif (token bearer sederhana, bukan JWT)
CREATE TABLE IF NOT EXISTS sessions (
  token      VARCHAR(64) PRIMARY KEY,
  user_id    VARCHAR(40) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS jurusan (
  id   VARCHAR(40) PRIMARY KEY,
  nama VARCHAR(150) NOT NULL
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rooms (
  id         VARCHAR(40) PRIMARY KEY,
  nama       VARCHAR(150) NOT NULL,
  STATUS     VARCHAR(20) NOT NULL DEFAULT 'Kosong',   -- 'Kosong' | 'Terpakai'
  kelas      VARCHAR(100) DEFAULT '',
  jurusan_id VARCHAR(40) DEFAULT ''
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schedules (
  id        VARCHAR(40) PRIMARY KEY,
  room_id   VARCHAR(40) NOT NULL,
  DAY       VARCHAR(10) NOT NULL,   -- Sen, Sel, Rab, Kam, Jum, Sab
  START     VARCHAR(10) NOT NULL,   -- "07:00"
  end_time  VARCHAR(10) NOT NULL,   -- "08:30"
  SUBJECT   VARCHAR(150),
  teacher   VARCHAR(150),
  color     VARCHAR(20)
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kelas_list (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL UNIQUE
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4;

-- Pengaturan aplikasi (satu baris global, id selalu 1)
CREATE TABLE IF NOT EXISTS app_settings (
  id           INT PRIMARY KEY,
  notifikasi   TINYINT(1) DEFAULT 1,
  mode_gelap   TINYINT(1) DEFAULT 0,
  bahasa       VARCHAR(30) DEFAULT 'Indonesia',
  tahun_ajaran VARCHAR(20) DEFAULT '2025/2026'
) ENGINE=INNODB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- SIRELA — Data Awal (Seed Data)
-- Jalankan setelah tabel-tabel dibuat (CREATE TABLE di atas)
-- =========================================================

USE sirela_db;

-- Akun admin default (username: admin, password: admin123)
-- Password disimpan ter-hash (scrypt + salt), bukan plaintext
INSERT INTO users (id, NAME, username, email, PASSWORD) VALUES
('1', 'jihan', 'jihan', 'jihanar@gmail.com', 'jihan')

-- Jurusan
INSERT INTO jurusan (id, nama) VALUES
('j1', 'Akuntansi'),
('j2', 'RPL'),
('j3', 'IPA'),
('j4', 'IPS');

-- Ruangan
INSERT INTO rooms (id, nama, STATUS, kelas, jurusan_id) VALUES
('r1', 'Ruang 101', 'Terpakai', 'X-RPL-1', 'j2'),
('r2', 'Ruang 102', 'Kosong', '', ''),
('r3', 'Ruang 103', 'Terpakai', 'XI-RPL-2', 'j1'),
('r4', 'Ruang 104', 'Kosong', '', '');

-- Jadwal
INSERT INTO schedules (id, room_id, DAY, START, end_time, SUBJECT, teacher, color) VALUES
('s1', 'r1', 'Senin', '07:00', '08:30', 'Matematika XI', 'Dr. Sarah Collins', '#2A5FCE'),
('s2', 'r2', 'Selasa', '08:30', '10:00', 'Fisika XI', 'Mr. James Smith', '#1E6B44'),
('s3', 'r3', 'Rabu', '10:15', '11:45', 'Sastra Inggris', 'Mrs. Diana Walsh', '#E38B29'),
('s4', 'r1', 'Kamis', '13:00', '14:30', 'Biologi XI', 'Dr. Emily Brown', '#A32D2D');

-- Daftar kelas
INSERT INTO kelas_list (nama) VALUES
('X-RPL-1'),
('XI-RPL-2'),
('XI-RPL-3'),`users`
('XI-RPL-4');

-- Pengaturan aplikasi (satu baris global)
INSERT INTO app_settings (id, notifikasi, mode_gelap, bahasa, tahun_ajaran) VALUES
(1, 1, 0, 'Indonesia', '2025/2026');
