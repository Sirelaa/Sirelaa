/* =========================================================
   SIRELA — Server (versi MySQL/MariaDB)
   ========================================================= */

   const http = require("node:http");
   const fs = require("node:fs");
   const path = require("node:path");
   const url = require("node:url");
   const DB = require("./db.js");
   
   const PORT = process.env.PORT || 3000;
   const PUBLIC_DIR = path.join(__dirname, "public");
   
   // 🛠️ UBAH JADI TRUE KALAU MAU MAINTENANCE, FALSE KALAU NORMAL
   const IS_MAINTENANCE = false;
   
   const MIME = {
     ".html": "text/html; charset=utf-8",
     ".css": "text/css; charset=utf-8",
     ".js": "text/javascript; charset=utf-8",
     ".json": "application/json; charset=utf-8",
     ".png": "image/png",
     ".jpg": "image/jpeg",
     ".svg": "image/svg+xml",
     ".ico": "image/x-icon"
   };
   
   function sendJSON(res, status, data) {
     const body = JSON.stringify(data);
     res.writeHead(status, {
       "Content-Type": "application/json; charset=utf-8",
       "Access-Control-Allow-Origin": "*",
       "Access-Control-Allow-Headers": "Content-Type, Authorization",
       "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
     });
     res.end(body);
   }
   
   function readBody(req) {
     return new Promise((resolve, reject) => {
       let chunks = [];
       req.on("data", (c) => chunks.push(c));
       req.on("end", () => {
         if (chunks.length === 0) return resolve({});
         try {
           resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
         } catch (e) {
           reject(new Error("Invalid JSON body"));
         }
       });
       req.on("error", reject);
     });
   }
   
   async function getAuthUser(req) {
     const header = req.headers["authorization"] || "";
     const token = header.startsWith("Bearer ") ? header.slice(7) : null;
     const user = await DB.getUserBySession(token);
     return { token, user };
   }
   
   function serveStatic(req, res, pathname) {
     let filePath = pathname === "/" ? "/index.html" : pathname;
     filePath = path.join(PUBLIC_DIR, filePath);
   
     if (!filePath.startsWith(PUBLIC_DIR)) {
       res.writeHead(403);
       return res.end("Forbidden");
     }
   
     fs.readFile(filePath, (err, data) => {
       if (err) {
         res.writeHead(404, { "Content-Type": "text/plain" });
         return res.end("Not found");
       }
       const ext = path.extname(filePath);
       res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
       res.end(data);
     });
   }
   
   async function handleApi(req, res, pathname) {
     const method = req.method;
   
     try {
       if (pathname === "/api/maintenance-status" && method === "GET") {
         return sendJSON(res, 200, { isMaintenance: IS_MAINTENANCE });
       }
   
       if (IS_MAINTENANCE) {
         return sendJSON(res, 503, { error: "Aplikasi sedang dalam pemeliharaan (Maintenance)" });
       }
   
       if (pathname === "/api/auth/login" && method === "POST") {
         const { username, password } = await readBody(req);
         const user = await DB.findUserByUsername((username || "").trim());
         if (!user || (password || "") !== user.password) {
           return sendJSON(res, 401, { error: "Nama pengguna atau kata sandi salah" });
         }
         const token = await DB.createSession(user.id);
         return sendJSON(res, 200, { token, user: DB.publicUser(user) });
       }
   
       if (pathname === "/api/auth/register" && method === "POST") {
         const { name, username, email, password } = await readBody(req);
         if (!name || !username || !email || !password) {
           return sendJSON(res, 400, { error: "Lengkapi semua data terlebih dahulu" });
         }
         if (await DB.findUserByUsername(username.trim())) {
           return sendJSON(res, 409, { error: "Nama pengguna sudah digunakan" });
         }
         const user = await DB.createUser({ name: name.trim(), username: username.trim(), email: email.trim(), password });
         const token = await DB.createSession(user.id);
         return sendJSON(res, 201, { token, user: DB.publicUser(user) });
       }
   
       if (pathname === "/api/auth/sso" && method === "POST") {
         const user = await DB.findUserByUsername("admin");
         if (!user) return sendJSON(res, 404, { error: "Akun default tidak ditemukan" });
         const token = await DB.createSession(user.id);
         return sendJSON(res, 200, { token, user: DB.publicUser(user) });
       }
   
       if (pathname === "/api/auth/logout" && method === "POST") {
         const { token } = await getAuthUser(req);
         if (token) await DB.deleteSession(token);
         return sendJSON(res, 200, { ok: true });
       }
   
       if (pathname === "/api/auth/change-password" && method === "POST") {
         const { user } = await getAuthUser(req);
         if (!user) return sendJSON(res, 401, { error: "Belum masuk" });
         const { oldPassword, newPassword } = await readBody(req);
         if ((oldPassword || "") !== user.password) {
           return sendJSON(res, 401, { error: "Kata sandi saat ini salah" });
         }
         if (!newPassword) return sendJSON(res, 400, { error: "Kata sandi baru wajib diisi" });
         await DB.updateUserPassword(user.id, newPassword);
         return sendJSON(res, 200, { ok: true });
       }
   
       if (pathname === "/api/bootstrap" && method === "GET") {
         const { user } = await getAuthUser(req);
         if (!user) return sendJSON(res, 401, { error: "Belum masuk" });
         return sendJSON(res, 200, {
           user: DB.publicUser(user),
           settings: await DB.getSettings(),
           jurusan: await DB.listJurusan(),
           rooms: await DB.listRooms(),
           schedules: await DB.listSchedules(),
           kelasList: await DB.listKelas()
         });
       }
   
       const { user } = await getAuthUser(req);
       if (!user) return sendJSON(res, 401, { error: "Belum masuk" });
   
       if (pathname === "/api/settings" && method === "PUT") {
         const patch = await readBody(req);
         return sendJSON(res, 200, await DB.updateSettings(patch));
       }
   
       if (pathname === "/api/jurusan" && method === "POST") {
         const { nama } = await readBody(req);
         if (!nama || !nama.trim()) return sendJSON(res, 400, { error: "Nama jurusan wajib diisi" });
         return sendJSON(res, 201, await DB.createJurusan(nama.trim()));
       }
       let m = pathname.match(/^\/api\/jurusan\/([^/]+)$/);
       if (m && method === "DELETE") {
         await DB.deleteJurusan(m[1]);
         return sendJSON(res, 200, { ok: true });
       }
   
       if (pathname === "/api/rooms" && method === "POST") {
         const body = await readBody(req);
         if (!body.nama || !body.nama.trim()) return sendJSON(res, 400, { error: "Nama ruangan wajib diisi" });
         return sendJSON(res, 201, await DB.createRoom(body));
       }
       m = pathname.match(/^\/api\/rooms\/([^/]+)$/);
       if (m && method === "PUT") {
         const patch = await readBody(req);
         const updated = await DB.updateRoom(m[1], patch);
         if (!updated) return sendJSON(res, 404, { error: "Ruangan tidak ditemukan" });
         return sendJSON(res, 200, updated);
       }
       if (m && method === "DELETE") {
         await DB.deleteSchedulesByRoom(m[1]);
         await DB.deleteRoom(m[1]);
         return sendJSON(res, 200, { ok: true });
       }
   
       if (pathname === "/api/schedules" && method === "POST") {
         const body = await readBody(req);
         if (!body.roomId || !body.day || !body.start || !body.end) {
           return sendJSON(res, 400, { error: "Lengkapi data jadwal terlebih dahulu" });
         }
         return sendJSON(res, 201, await DB.createSchedule(body));
       }
       m = pathname.match(/^\/api\/schedules\/([^/]+)$/);
       if (m && method === "PUT") {
         const patch = await readBody(req);
         const updated = await DB.updateSchedule(m[1], patch);
         if (!updated) return sendJSON(res, 404, { error: "Jadwal tidak ditemukan" });
         return sendJSON(res, 200, updated);
       }
       if (m && method === "DELETE") {
         await DB.deleteSchedule(m[1]);
         return sendJSON(res, 200, { ok: true });
       }
   
       if (pathname === "/api/kelas" && method === "POST") {
         const { nama } = await readBody(req);
         if (!nama || !nama.trim()) return sendJSON(res, 400, { error: "Nama kelas wajib diisi" });
         return sendJSON(res, 201, { kelasList: await DB.addKelas(nama.trim()) });
       }
       m = pathname.match(/^\/api\/kelas\/([^/]+)$/);
       if (m && method === "DELETE") {
         return sendJSON(res, 200, { kelasList: await DB.deleteKelas(m[1]) });
       }
   
       return sendJSON(res, 404, { error: "Endpoint tidak ditemukan" });
     } catch (err) {
       console.error(err);
       return sendJSON(res, 500, { error: "Terjadi kesalahan server", detail: err.message });
     }
   }
   
   const server = http.createServer((req, res) => {
     const parsed = url.parse(req.url);
     const pathname = decodeURIComponent(parsed.pathname);
   
     if (req.method === "OPTIONS") {
       res.writeHead(204, {
         "Access-Control-Allow-Origin": "*",
         "Access-Control-Allow-Headers": "Content-Type, Authorization",
         "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
       });
       return res.end();
     }
   
     if (pathname.startsWith("/api/")) {
       return handleApi(req, res, pathname);
     }
     return serveStatic(req, res, pathname);
   });
   
   (async () => {
     try {
       console.log("Menghubungkan ke MySQL/MariaDB...");
       await DB.init();
       console.log("Database siap.");
       server.listen(PORT, () => {
         console.log(`SIRELA server jalan di http://localhost:${PORT}`);
       });
     } catch (err) {
       console.error("Gagal konek ke database:", err.message);
       process.exit(1);
     }
   })();