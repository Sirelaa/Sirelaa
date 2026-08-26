# Cara Ubah SIRELA Jadi File .apk (Bisa Dikirim & Di-install Langsung)

Project ini adalah "pembungkus" SIRELA (pakai Capacitor) supaya jadi
aplikasi Android asli (.apk), bukan lagi cuma dibuka lewat browser.

**Catatan penting:** APK ini tetap butuh internet dan tetap konek ke server
SIRELA yang online (sama seperti versi PWA). Jadi urutannya harus begini:

1. Deploy server dulu (ikuti `CARA-DEPLOY-KE-HP.md` di project SIRELA asli —
   Bagian 1-3: Aiven + Render), sampai dapat link seperti
   `https://sirela.onrender.com`.
2. Baru lanjut build APK di panduan ini.

---

## Yang kamu butuhkan di komputer (bukan HP)

1. **Android Studio** (gratis) — download di https://developer.android.com/studio
2. **Node.js** versi 18+ (`node --version`) — kalau belum ada, download di
   https://nodejs.org

---

## Langkah-langkah

### 1. Extract & install dependency

Extract file zip ini, buka terminal/PowerShell di dalam folder itu, lalu:

```
npm install
```

### 2. Isi link server kamu

Buka file **`www/config.js`**, ganti baris ini:

```js
window.SIRELA_API_BASE = "https://GANTI-DENGAN-LINK-RENDER-KAMU.onrender.com";
```

dengan link Render kamu yang sebenarnya (tanpa garis miring `/` di akhir).

### 3. Sinkronkan ke project Android

```
npx cap sync android
```

(Jalankan ini lagi setiap kali kamu edit file di dalam folder `www/`.)

### 4. Buka di Android Studio

1. Buka **Android Studio** → **Open** → pilih folder `android` di dalam
   project ini (bukan folder utama, tapi sub-folder `android`-nya).
2. Tunggu proses **Gradle sync** selesai (beberapa menit di percobaan
   pertama, Android Studio akan download beberapa komponen).

### 5. Build APK

1. Di menu atas: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
2. Tunggu sampai selesai, nanti muncul notifikasi kecil di pojok kanan
   bawah "APK(s) generated successfully" — klik **locate** untuk buka
   folernya.
3. File APK-nya ada di:
   `android/app/build/outputs/apk/debug/app-debug.apk`

### 6. Bagikan & install

- Kirim file `app-debug.apk` itu ke teman-teman (lewat WhatsApp, Google
  Drive, dll).
- Di HP Android teman: buka file itu → kalau muncul peringatan, tap
  **Setelan** → aktifkan **"Izinkan dari sumber ini"** → lalu **Install**.
- Ikon SIRELA muncul di home screen & app drawer seperti aplikasi biasa.

---

## Kalau mau ganti nama & ikon aplikasi

- **Nama app**: edit `android/app/src/main/res/values/strings.xml`, ubah
  nilai `app_name`.
- **Ikon app**: klik kanan folder `android/app/src/main/res` di Android
  Studio → **New → Image Asset** → pilih gambar ikon SIRELA kamu
  (`www/icon-512.png` sudah ada di project ini) → ikuti wizard-nya.

## Kalau ada masalah

- **APK terinstall tapi layar putih/blank** → cek lagi isi `www/config.js`,
  pastikan link server-nya benar dan server Render-nya sedang aktif
  (buka link itu dulu di browser HP, tunggu sampai bisa dibuka).
- **"App not installed"** → biasanya karena ada versi lama SIRELA yang
  sudah ter-install dengan konfigurasi beda; uninstall dulu versi lama,
  baru install yang baru.
- **Login gagal / data tidak muncul** → sama seperti versi web, cek server
  Render-nya jalan normal (buka linknya langsung di browser HP untuk tes).
- Kalau nanti mau naik level jadi APK yang bisa dipasang tanpa warning
  "sumber tidak dikenal" (misalnya lewat toko aplikasi lain atau upload ke
  Play Store beneran), APK ini perlu di-"sign" dengan release key — tanya
  saja kalau butuh panduan itu juga.
