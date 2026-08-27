/* =========================================================
   SIRELA — Sistem Informasi Ruang dan Jadwal
   Vanilla JS single-file app logic.
   Data SEKARANG tersimpan di server (SQLite), bukan localStorage lagi.
   Komunikasi lewat REST API di /api/*.
   ========================================================= */

const DAYS = ["Sen","Sel","Rab","Kam","Jum","Sab"];

/* ---------------- API helper ---------------- */
function getToken(){ return localStorage.getItem("sirela_token"); }
function setToken(t){ if(t) localStorage.setItem("sirela_token", t); else localStorage.removeItem("sirela_token"); }

async function api(path, { method="GET", body } = {}){
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if(token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch("/api" + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let data = null;
  try{ data = await res.json(); }catch(e){ data = null; }

  if(!res.ok){
    const err = new Error((data && data.error) || "Terjadi kesalahan");
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------- State (di-cache di memori, sumber kebenaran ada di server) ---------------- */
let STATE = {
  currentUser: null,
  settings: { notifikasi:true, modeGelap:false, bahasa:"Indonesia", tahunAjaran:"2025/2026" },
  jurusan: [],
  rooms: [],
  schedules: [],
  kelasList: []
};

async function refreshState(){
  const data = await api("/bootstrap");
  STATE = { ...data, currentUser: data.user };
}

function uid(prefix){ return prefix + "_" + Math.random().toString(36).slice(2,9); }

/* ---------------- Toast ---------------- */
let toastTimer;
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove("show"), 2200);
}

/* ---------------- View switching ---------------- */
function showView(id){
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

async function goApp(){
  showView("view-app");
  await refreshState();
  renderAll();
  goToPage("dashboard");
  document.body.classList.toggle("dark-mode", !!STATE.settings.modeGelap);
}

/* ---------------- Auth ---------------- */
document.getElementById("link-to-register").addEventListener("click", ()=> showView("view-register"));
document.getElementById("link-to-login").addEventListener("click", ()=> showView("view-login"));

document.getElementById("btn-sso").addEventListener("click", async ()=>{
  try{
    const { token } = await api("/auth/sso", { method:"POST" });
    setToken(token);
    showToast("Masuk dengan Google berhasil");
    await goApp();
  }catch(e){
    showToast(e.message);
  }
});

document.getElementById("login-show-pass").addEventListener("change", (e)=>{
  document.getElementById("login-password").type = e.target.checked ? "text" : "password";
});
function setLoginEmailError(msg){
  const field = document.getElementById("login-email-field");
  const errEl = document.getElementById("login-email-error");
  if(msg){
    field.classList.add("error");
    if(errEl) errEl.textContent = msg;
  } else {
    field.classList.remove("error");
  }
}
document.getElementById("reg-show-pass").addEventListener("change", (e)=>{
  const type = e.target.checked ? "text" : "password";
  document.getElementById("reg-password").type = type;
  document.getElementById("reg-password2").type = type;
});

document.getElementById("form-login").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const pField = document.getElementById("login-password-field");
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  setLoginEmailError(!email ? "Email wajib diisi" : "");
  pField.classList.toggle("error", !password);
  if(!email || !password) return;

  try{
    const { token } = await api("/auth/login", { method:"POST", body:{ email, password } });
    setToken(token);
    await goApp();
  }catch(err){
    // Tandai kolom yang relevan sesuai jenis error dari server
    if(err.status === 404){
      setLoginEmailError(err.message);
    } else if(err.status === 401){
      setLoginEmailError("");
      pField.classList.add("error");
    } else {
      setLoginEmailError("");
      pField.classList.remove("error");
    }
    showToast(err.message);
  }
});

document.getElementById("form-register").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const username = document.getElementById("reg-username").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const password2 = document.getElementById("reg-password2").value;
  const errField = document.getElementById("reg-pass-error").closest(".field");

  if(password !== password2){
    errField.classList.add("error");
    return;
  }
  errField.classList.remove("error");

  if(!name || !username || !email || !password){
    showToast("Lengkapi semua data terlebih dahulu");
    return;
  }

  const usernameField = document.getElementById("reg-username").closest(".field");
  const emailField = document.getElementById("reg-email").closest(".field");
  usernameField.classList.remove("error");
  emailField.classList.remove("error");

  try{
    const { token } = await api("/auth/register", { method:"POST", body:{ name, username, email, password } });
    setToken(token);
    showToast("Akun berhasil dibuat");
    await goApp();
  }catch(err){
    if(err.status === 409){
      if(/pengguna/i.test(err.message)) usernameField.classList.add("error");
      if(/email/i.test(err.message)) emailField.classList.add("error");
    }
    showToast(err.message);
  }
});

/* ---------------- Drawer menu ---------------- */
let currentPage = "dashboard";
const MENU_ITEMS = [
  { key:"dashboard", icon:"🏠", label:"Dashboard" },
  { key:"ruangan", icon:"🚪", label:"Data ruangan" },
  { key:"jadwal", icon:"🗓", label:"Jadwal" },
  { key:"jurusan", icon:"🎓", label:"Jurusan" },
  { key:"pengaturan", icon:"⚙", label:"Pengaturan" }
];

document.querySelector(".hamburger").addEventListener("click", openDrawer);

function openDrawer(){
  const root = document.getElementById("drawer-root");
  const user = STATE.currentUser || {};
  const initials = (user.name||"Admin SIRELA").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  root.innerHTML = `
    <div class="drawer-overlay" id="drawer-overlay">
      <div class="drawer-panel" onclick="event.stopPropagation()">
        <div class="drawer-head">
          <div class="drawer-logo">🔒</div>
          <div>
            <p class="dtitle">SIRELA</p>
            <p class="dsub">Sistem Informasi Ruang dan Jadwal</p>
          </div>
        </div>
        <div class="drawer-nav">
          ${MENU_ITEMS.map(m=>`
            <button class="drawer-item ${m.key===currentPage?'active':''}" data-page="${m.key}">
              <span class="dicon">${m.icon}</span>${m.label}
            </button>`).join("")}
        </div>
        <div class="drawer-footer">
          <div class="drawer-avatar">${initials}</div>
          <div>
            <p class="dfname">${user.name || "Admin SIRELA"}</p>
            <p class="drole">Administrator</p>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById("drawer-overlay").addEventListener("click", closeDrawer);
  root.querySelectorAll(".drawer-item").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      goToPage(btn.dataset.page);
      closeDrawer();
    });
  });
}
function closeDrawer(){
  document.getElementById("drawer-root").innerHTML = "";
}

function goToPage(page){
  currentPage = page;
  document.querySelectorAll(".page-content").forEach(p=>p.classList.add("hidden"));
  document.getElementById("page-"+page).classList.remove("hidden");

  const titles = {
    dashboard: ["SIRELA","Sistem Informasi Ruang dan Jadwal"],
    ruangan: ["Data ruangan",""],
    jadwal: ["Jadwal",""],
    jurusan: ["Jurusan",""],
    pengaturan: ["Pengaturan",""]
  };
  document.getElementById("topbar-title").textContent = titles[page][0];
  const sub = document.getElementById("topbar-sub");
  sub.textContent = titles[page][1];
  sub.style.display = titles[page][1] ? "block" : "none";

  if(page === "ruangan") renderRuanganPage();
  if(page === "jadwal") renderJadwalPage();
  if(page === "jurusan") renderJurusanPage();
  if(page === "pengaturan") renderPengaturanPage();
}

/* ---------------- Pengaturan page ---------------- */
function renderPengaturanPage(){
  const user = STATE.currentUser || {};
  const initials = (user.name||"Admin SIRELA").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  document.getElementById("profile-avatar").textContent = initials;
  document.getElementById("profile-name").textContent = user.name || "Admin SIRELA";
  document.getElementById("profile-email").textContent = user.email || "admin@sirela.sch.id";

  document.getElementById("setting-notif").checked = STATE.settings.notifikasi;
  document.getElementById("setting-dark").checked = STATE.settings.modeGelap;
  document.body.classList.toggle("dark-mode", STATE.settings.modeGelap);
}

document.getElementById("setting-notif").addEventListener("change", async (e)=>{
  const val = e.target.checked;
  STATE.settings.notifikasi = val;
  try{
    STATE.settings = await api("/settings", { method:"PUT", body:{ notifikasi: val } });
    showToast(val ? "Notifikasi diaktifkan" : "Notifikasi dimatikan");
  }catch(err){ showToast(err.message); }
});
document.getElementById("setting-dark").addEventListener("change", async (e)=>{
  const val = e.target.checked;
  document.body.classList.toggle("dark-mode", val);
  try{
    STATE.settings = await api("/settings", { method:"PUT", body:{ modeGelap: val } });
  }catch(err){ showToast(err.message); }
});
document.getElementById("row-ubah-sandi").addEventListener("click", openUbahSandi);
document.getElementById("btn-keluar-akun").addEventListener("click", ()=>{
  openModal(`
    <div class="confirm-icon">!</div>
    <p class="confirm-title">Keluar akun?</p>
    <p class="confirm-text">Anda perlu masuk kembali untuk mengakses SIRELA.</p>
    <div class="confirm-btns">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-red" onclick="submitKeluarAkun()">Ya, keluar</button>
    </div>
  `, {center:true});
});
async function submitKeluarAkun(){
  try{ await api("/auth/logout", { method:"POST" }); }catch(e){}
  setToken(null);
  STATE.currentUser = null;
  closeModal();
  document.getElementById("login-email").value = "";
  document.getElementById("login-password").value = "";
  showView("view-login");
}

function openUbahSandi(){
  openModal(`
    <div class="modal-head">
      <h3>Ubah kata sandi</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <hr class="modal-hr">
    <div class="field">
      <label>Kata sandi saat ini</label>
      <input type="password" id="m-old-pass" placeholder="Masukkan kata sandi saat ini">
    </div>
    <div class="field">
      <label>Kata sandi baru</label>
      <input type="password" id="m-new-pass" placeholder="Buat kata sandi baru">
    </div>
    <div class="field">
      <label>Konfirmasi kata sandi baru</label>
      <input type="password" id="m-new-pass2" placeholder="Ulangi kata sandi baru">
    </div>
    <button class="btn btn-navy" onclick="submitUbahSandi()">Simpan kata sandi</button>
  `);
}
async function submitUbahSandi(){
  const oldPass = document.getElementById("m-old-pass").value;
  const newPass = document.getElementById("m-new-pass").value;
  const newPass2 = document.getElementById("m-new-pass2").value;

  if(!newPass || newPass !== newPass2){ showToast("Konfirmasi kata sandi tidak cocok"); return; }

  try{
    await api("/auth/change-password", { method:"POST", body:{ oldPassword: oldPass, newPassword: newPass } });
    closeModal();
    showToast("Kata sandi berhasil diubah");
  }catch(err){
    showToast(err.message);
  }
}

/* ---------------- Renderers ---------------- */
function renderAll(){
  renderDashboard();
  renderRuanganPage();
  renderJadwalPage();
  renderJurusanPage();
}

function jurusanName(id){
  const j = STATE.jurusan.find(j=>j.id===id);
  return j ? j.nama : "";
}

function roomBadge(room){
  return room.status === "Terpakai"
    ? `<span class="badge badge-red">Terpakai</span>`
    : `<span class="badge badge-green">Kosong</span>`;
}

function renderDashboard(){
  const total = STATE.rooms.length;
  const terpakai = STATE.rooms.filter(r=>r.status==="Terpakai").length;
  const kosong = total - terpakai;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-terpakai").textContent = terpakai;
  document.getElementById("stat-kosong").textContent = kosong;

  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { day:"numeric", month:"long", year:"numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" }) + " WIB";
  document.getElementById("dash-datetime").textContent = `${dateStr}      ${timeStr}`;

  const list = document.getElementById("dash-room-list");
  const visible = STATE.rooms.slice(0,5);
  list.innerHTML = visible.map(r=>{
    const sched = STATE.schedules.find(s=>s.roomId===r.id && s.day===currentDay());
    const subj = sched ? sched.subject : (r.kelas ? "" : "");
    const teacherLine = sched ? `<span class="teacher">${sched.teacher}</span>` : "";
    return `
      <div class="room-row">
        <div>
          <span class="rname">${r.nama}</span>${subj ? `<span class="rclass">${subj}</span>` : (r.kelas ? `<span class="rclass">${r.kelas}</span>`:"")}
          <div>${roomBadge(r)}${r.jurusanId ? `<span class="badge badge-blue">${jurusanName(r.jurusanId)}</span>` : ""}</div>
        </div>
        <div class="rmeta">${teacherLine}</div>
      </div>`;
  }).join("");
  document.getElementById("dash-footnote").textContent = `Menampilkan ${visible.length} dari ${total} ruangan`;
}

function currentDay(){
  const idx = new Date().getDay(); // 0 = Sunday
  const map = [null,"Sen","Sel","Rab","Kam","Jum","Sab"];
  return map[idx] || "Sen";
}

function renderRuanganPage(){
  const list = document.getElementById("ruangan-list");
  list.innerHTML = STATE.rooms.map(r=>{
    const info = r.status === "Terpakai" && r.kelas
      ? `Kelas: ${r.kelas}` : "Belum ada kelas";
    return `
      <div class="room-card" onclick="openEditRuangan('${r.id}')">
        <div class="left">
          <div class="name">${r.nama}</div>
          ${roomBadge(r)}
        </div>
        <div class="rmeta">${info}</div>
      </div>`;
  }).join("");
  document.getElementById("ruangan-footnote").textContent = `Menampilkan ${STATE.rooms.length} dari ${STATE.rooms.length} ruangan`;
}

let activeDay = currentDay();
function renderJadwalPage(){
  const tabs = document.getElementById("day-tabs");
  tabs.innerHTML = DAYS.map(d=>`<button class="day-tab ${d===activeDay?'active':''}" data-day="${d}">${d}</button>`).join("");
  tabs.querySelectorAll(".day-tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      activeDay = btn.dataset.day;
      renderJadwalPage();
    });
  });

  const list = document.getElementById("jadwal-list");
  const items = STATE.schedules.filter(s=>s.day===activeDay).sort((a,b)=>a.start.localeCompare(b.start));
  if(items.length === 0){
    list.innerHTML = `<div class="sched-empty">Belum ada jadwal di hari ${activeDay}</div>`;
    return;
  }
  list.innerHTML = items.map(s=>{
    const room = STATE.rooms.find(r=>r.id===s.roomId);
    return `
      <div class="sched-item">
        <div class="sched-bar" style="background:${s.color}"></div>
        <div>
          <div class="sched-time">${s.start} - ${s.end}</div>
          <div class="sched-title">${s.subject}, ${room ? room.nama : ""}</div>
          <div class="sched-teacher">${s.teacher}</div>
        </div>
      </div>`;
  }).join("");
}

const JURUSAN_STYLES = ["j-ipa","j-ips","j-bhs","j-all"];
const JURUSAN_ABBR = { "Akuntansi":"AK","RPL":"RPL","IPA":"IPA","IPS":"IPS" };
function renderJurusanPage(){
  const grid = document.getElementById("jurusan-grid");
  grid.innerHTML = STATE.jurusan.map((j,i)=>{
    const count = STATE.rooms.filter(r=>r.jurusanId===j.id).length;
    const styleClass = JURUSAN_STYLES[i % JURUSAN_STYLES.length];
    const abbr = JURUSAN_ABBR[j.nama] || j.nama.slice(0,3).toUpperCase();
    return `
      <div class="jurusan-card ${styleClass}">
        <div class="jurusan-icon">${abbr}</div>
        <div class="jname">${j.nama}</div>
        <div class="jcount">${count} kelas aktif</div>
      </div>`;
  }).join("");
}

/* ---------------- Modal helpers ---------------- */
function openModal(html, {center=false} = {}){
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-overlay ${center?'center':''}" id="modal-overlay"><div class="modal-sheet">${html}</div></div>`;
  document.getElementById("modal-overlay").addEventListener("click", (e)=>{
    if(e.target.id === "modal-overlay") closeModal();
  });
}
function closeModal(){
  document.getElementById("modal-root").innerHTML = "";
}
// Ganti isi modal yang sedang terbuka tanpa memicu ulang animasi buka/tutup
// (dipakai untuk navigasi "daftar -> detail" di dalam satu modal yang sama).
function swapModal(html){
  const sheet = document.querySelector("#modal-root .modal-sheet");
  if(sheet){ sheet.innerHTML = html; }
  else { openModal(html); }
}

/* ---------------- Modal: Tambah / Edit Ruangan ---------------- */
function jurusanOptions(selectedId){
  return `<option value="">— Tidak ada —</option>` + STATE.jurusan.map(j=>
    `<option value="${j.id}" ${j.id===selectedId?"selected":""}>${j.nama}</option>`
  ).join("");
}

function openTambahRuangan(){
  openModal(`
    <div class="modal-head">
      <h3>Tambah ruangan baru</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <hr class="modal-hr">
    <div class="field">
      <label>Nama ruangan</label>
      <input type="text" id="m-nama" placeholder="Contoh: Ruang 106">
    </div>
    <div class="field">
      <label>Status awal</label>
      <div class="status-toggle" id="m-status-toggle">
        <div class="status-opt opt-kosong active" data-val="Kosong">Kosong</div>
        <div class="status-opt opt-terpakai" data-val="Terpakai">Terpakai</div>
      </div>
    </div>
    <button class="btn btn-purple" onclick="submitTambahRuangan()">Simpan ruangan</button>
  `);
  bindStatusToggle();
}

function bindStatusToggle(containerId = "m-status-toggle"){
  const opts = document.querySelectorAll(`#${containerId} .status-opt`);
  opts.forEach(o=>{
    o.addEventListener("click", ()=>{
      opts.forEach(x=>x.classList.remove("active"));
      o.classList.add("active");
    });
  });
}
function getStatusToggleValue(){
  const active = document.querySelector("#m-status-toggle .status-opt.active");
  return active ? active.dataset.val : "Kosong";
}

async function submitTambahRuangan(){
  const nama = document.getElementById("m-nama").value.trim();
  if(!nama){ showToast("Nama ruangan wajib diisi"); return; }
  const status = getStatusToggleValue();

  try{
    await api("/rooms", { method:"POST", body:{ nama, status, kelas:"", jurusanId:"" } });
    await refreshState();
    closeModal();
    renderAll();
    showToast(`Ruangan "${nama}" berhasil ditambahkan`);
  }catch(err){ showToast(err.message); }
}

function editRuanganHTML(roomId){
  const r = STATE.rooms.find(x=>x.id===roomId);
  if(!r) return "";
  return `
    <div class="modal-head">
      <h3>Edit ruangan</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <hr class="modal-hr">
    <div class="field">
      <label>Nama ruangan</label>
      <input type="text" id="m-nama" value="${r.nama}">
    </div>
    <div class="field">
      <label>Status</label>
      <div class="status-toggle" id="m-status-toggle">
        <div class="status-opt opt-kosong ${r.status==='Kosong'?'active':''}" data-val="Kosong">Kosong</div>
        <div class="status-opt opt-terpakai ${r.status==='Terpakai'?'active':''}" data-val="Terpakai">Terpakai</div>
      </div>
    </div>
    <button class="btn btn-purple" onclick="submitEditRuangan('${r.id}')">Simpan perubahan</button>
    <button class="btn btn-outline" style="margin-top:10px;" onclick="closeModal(); openKosongkanRuangan('${r.id}')">Kosongkan ruangan ini</button>
    <button class="btn btn-outline-red" style="margin-top:10px;" onclick="openHapusRuangan('${r.id}')">Hapus ruangan</button>
  `;
}

function openEditRuangan(roomId){
  if(!STATE.rooms.find(x=>x.id===roomId)) return;
  openModal(editRuanganHTML(roomId));
  bindStatusToggle();
}

async function submitEditRuangan(roomId){
  const r = STATE.rooms.find(x=>x.id===roomId);
  if(!r) return;
  let nama = document.getElementById("m-nama").value.trim() || r.nama;
  let status = getStatusToggleValue();
  // Kelas & jurusan hanya ditentukan lewat "Tambah jadwal", jadi di sini kita
  // pertahankan nilai yang sudah ada kecuali ruangan dikosongkan.
  let kelas = status === "Kosong" ? "" : r.kelas;
  let jurusanId = status === "Kosong" ? "" : r.jurusanId;

  try{
    await api(`/rooms/${roomId}`, { method:"PUT", body:{ nama, jurusanId, kelas, status } });
    await refreshState();
    closeModal();
    renderAll();
    showToast("Perubahan ruangan disimpan");
  }catch(err){ showToast(err.message); }
}

/* ---------------- Modal: Hapus Ruangan (dipakai dari halaman Ruangan) ---------------- */
function openHapusRuangan(roomId){
  const r = STATE.rooms.find(x=>x.id===roomId);
  if(!r) return;
  openModal(`
    <div class="confirm-icon">!</div>
    <p class="confirm-title">Hapus ruangan?</p>
    <p class="confirm-text">${r.nama} beserta semua jadwal yang terkait akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.</p>
    <div class="confirm-btns">
      <button class="btn btn-outline" onclick="closeModal(); openEditRuangan('${r.id}')">Batal</button>
      <button class="btn btn-red" onclick="submitHapusRuangan('${r.id}')">Ya, hapus</button>
    </div>
  `, {center:true});
}

async function submitHapusRuangan(roomId){
  const r = STATE.rooms.find(x=>x.id===roomId);
  try{
    await api(`/rooms/${roomId}`, { method:"DELETE" });
    await refreshState();
    closeModal();
    renderAll();
    showToast(`${r ? r.nama : "Ruangan"} berhasil dihapus`);
  }catch(err){ showToast(err.message); }
}

/* ---------------- Modal: Kelola Ruangan (aksi inline, tanpa pindah tampilan) ---------------- */
function openKelolaRuangan(){
  openModal(`
    <div class="modal-head">
      <h3>Kelola ruangan</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <hr class="modal-hr">
    <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px;">DAFTAR RUANGAN</div>
    <div id="ruangan-manage-list"></div>
    <button class="btn btn-ghost" style="margin-top:6px;" onclick="closeModal()">Tutup</button>
  `);
  ruanganExpandedId = null;
  ruanganExpandedMode = null;
  renderRuanganManageList();
}

let ruanganExpandedId = null;
let ruanganExpandedMode = null; // 'edit' | 'kosongkan' | 'hapus'

function toggleRuanganAction(roomId, mode){
  if(ruanganExpandedId === roomId && ruanganExpandedMode === mode){
    ruanganExpandedId = null; ruanganExpandedMode = null;
  } else {
    ruanganExpandedId = roomId; ruanganExpandedMode = mode;
  }
  renderRuanganManageList();
}

function renderRuanganManageList(){
  const list = document.getElementById("ruangan-manage-list");
  if(!list) return;
  if(STATE.rooms.length === 0){
    list.innerHTML = `<p class="footnote">Belum ada ruangan</p>`;
    return;
  }
  list.innerHTML = STATE.rooms.map(r=>{
    const info = r.status === "Terpakai" && r.kelas ? r.kelas : "Belum ada kelas";
    const mode = ruanganExpandedId === r.id ? ruanganExpandedMode : null;
    let panel = "";
    if(mode === "edit"){
      panel = `
        <div class="ruangan-inline-panel">
          <div class="field">
            <label>Nama ruangan</label>
            <input type="text" id="inline-nama-${r.id}" value="${r.nama}">
          </div>
          <div class="field">
            <label>Status</label>
            <div class="status-toggle" id="ruangan-status-${r.id}">
              <div class="status-opt opt-kosong ${r.status==='Kosong'?'active':''}" data-val="Kosong">Kosong</div>
              <div class="status-opt opt-terpakai ${r.status==='Terpakai'?'active':''}" data-val="Terpakai">Terpakai</div>
            </div>
          </div>
          <button class="btn btn-purple btn-sm" onclick="submitInlineEditRuangan('${r.id}')">Simpan perubahan</button>
        </div>`;
    } else if(mode === "kosongkan"){
      panel = `
        <div class="ruangan-inline-panel">
          <p class="confirm-text">${r.nama} akan diubah statusnya menjadi Kosong dan jadwal terkait dilepas dari ruangan ini.</p>
          <div class="confirm-btns">
            <button class="btn btn-outline btn-sm" onclick="toggleRuanganAction('${r.id}','kosongkan')">Batal</button>
            <button class="btn btn-red btn-sm" onclick="submitKosongkanRuanganInline('${r.id}')">Ya, kosongkan</button>
          </div>
        </div>`;
    } else if(mode === "hapus"){
      panel = `
        <div class="ruangan-inline-panel">
          <p class="confirm-text">${r.nama} beserta semua jadwal terkait akan dihapus permanen.</p>
          <div class="confirm-btns">
            <button class="btn btn-outline btn-sm" onclick="toggleRuanganAction('${r.id}','hapus')">Batal</button>
            <button class="btn btn-red btn-sm" onclick="submitHapusRuanganInline('${r.id}')">Ya, hapus</button>
          </div>
        </div>`;
    }
    return `
      <div class="ruangan-manage-row">
        <div class="jurusan-manage-item">
          <div class="jm-left">
            <div class="jm-name">${r.nama}</div>
            <div class="jm-count">${info}</div>
          </div>
          <div class="jm-actions">
            ${roomBadge(r)}
            <button class="icon-btn edit" onclick="toggleRuanganAction('${r.id}','edit')" title="Edit">✎</button>
            <button class="icon-btn warn" onclick="toggleRuanganAction('${r.id}','kosongkan')" title="Kosongkan">⭘</button>
            <button class="icon-btn del" onclick="toggleRuanganAction('${r.id}','hapus')" title="Hapus">✕</button>
          </div>
        </div>
        ${panel}
      </div>`;
  }).join("");

  if(ruanganExpandedId && ruanganExpandedMode === "edit"){
    bindStatusToggle(`ruangan-status-${ruanganExpandedId}`);
  }
}

async function submitInlineEditRuangan(roomId){
  const r = STATE.rooms.find(x=>x.id===roomId);
  if(!r) return;
  const nama = document.getElementById(`inline-nama-${roomId}`).value.trim() || r.nama;
  const activeOpt = document.querySelector(`#ruangan-status-${roomId} .status-opt.active`);
  const status = activeOpt ? activeOpt.dataset.val : r.status;
  const kelas = status === "Kosong" ? "" : r.kelas;
  const jurusanId = status === "Kosong" ? "" : r.jurusanId;

  try{
    await api(`/rooms/${roomId}`, { method:"PUT", body:{ nama, jurusanId, kelas, status } });
    await refreshState();
    ruanganExpandedId = null; ruanganExpandedMode = null;
    renderRuanganManageList();
    renderAll();
    showToast("Perubahan ruangan disimpan");
  }catch(err){ showToast(err.message); }
}

async function submitKosongkanRuanganInline(roomId){
  const r = STATE.rooms.find(x=>x.id===roomId);
  try{
    await api(`/rooms/${roomId}`, { method:"PUT", body:{ status:"Kosong", kelas:"", jurusanId:"" } });
    await refreshState();
    ruanganExpandedId = null; ruanganExpandedMode = null;
    renderRuanganManageList();
    renderAll();
    showToast(`${r ? r.nama : "Ruangan"} dikosongkan`);
  }catch(err){ showToast(err.message); }
}

async function submitHapusRuanganInline(roomId){
  const r = STATE.rooms.find(x=>x.id===roomId);
  try{
    await api(`/rooms/${roomId}`, { method:"DELETE" });
    await refreshState();
    ruanganExpandedId = null; ruanganExpandedMode = null;
    renderRuanganManageList();
    renderAll();
    showToast(`${r ? r.nama : "Ruangan"} berhasil dihapus`);
  }catch(err){ showToast(err.message); }
}

/* ---------------- Modal: Kosongkan Ruangan (dipakai dari halaman Ruangan) ---------------- */
function openKosongkanRuangan(preselectId){
  const terpakaiRooms = STATE.rooms.filter(r=>r.status==="Terpakai");
  if(terpakaiRooms.length === 0){ showToast("Tidak ada ruangan yang terpakai"); return; }
  const initialId = (preselectId && terpakaiRooms.some(r=>r.id===preselectId)) ? preselectId : terpakaiRooms[0].id;

  openModal(`
    <div class="modal-head">
      <h3>Kosongkan ruangan</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <hr class="modal-hr">
    <div class="field">
      <label>Pilih ruangan</label>
      <div class="select-wrap">
        <select id="m-kosongkan-room">
          ${terpakaiRooms.map(r=>`<option value="${r.id}" ${r.id===initialId?"selected":""}>${r.nama}${r.kelas ? " — "+r.kelas : ""}</option>`).join("")}
        </select>
      </div>
    </div>
    <p class="confirm-text" id="m-kosongkan-desc" style="margin-top:12px;"></p>
    <div class="confirm-btns">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-red" onclick="submitKosongkanRuangan(document.getElementById('m-kosongkan-room').value)">Ya, kosongkan</button>
    </div>
  `);

  const select = document.getElementById("m-kosongkan-room");
  const updateDesc = ()=>{
    const r = STATE.rooms.find(x=>x.id===select.value);
    document.getElementById("m-kosongkan-desc").textContent = r
      ? `${r.nama} akan diubah statusnya menjadi Kosong dan jadwal terkait akan dihapus dari ruangan ini.`
      : "";
  };
  select.addEventListener("change", updateDesc);
  updateDesc();
}
async function submitKosongkanRuangan(roomId){
  const r = STATE.rooms.find(x=>x.id===roomId);
  try{
    await api(`/rooms/${roomId}`, { method:"PUT", body:{ status:"Kosong", kelas:"", jurusanId:"" } });
    // Hapus semua jadwal yang terkait ruangan ini
    const relatedSched = STATE.schedules.filter(s=>s.roomId===roomId);
    for(const s of relatedSched){
      await api(`/schedules/${s.id}`, { method:"DELETE" });
    }
    await refreshState();
    closeModal();
    renderAll();
    showToast(`${r ? r.nama : "Ruangan"} berhasil dikosongkan`);
  }catch(err){ showToast(err.message); }
}

/* ---------------- Modal: Tambah Jadwal ---------------- */
function roomOptions(selectedId){
  return STATE.rooms.map(r=>`<option value="${r.id}" ${r.id===selectedId?"selected":""}>${r.nama}</option>`).join("");
}
function dayOptions(selected){
  return DAYS.map(d=>`<option value="${d}" ${d===selected?"selected":""}>${d}</option>`).join("");
}

function kelasOptions(selected){
  return `<option value="">Pilih kelas</option>` + STATE.kelasList.map(k=>
    `<option value="${k}" ${k===selected?"selected":""}>${k}</option>`
  ).join("");
}

function openTambahJadwal(){
  openModal(`
    <div class="modal-head">
      <h3>Tambah jadwal baru</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <hr class="modal-hr">
    <div class="field">
      <label>Ruangan</label>
      <div class="select-wrap"><select id="m-room">${roomOptions()}</select></div>
    </div>
    <div class="field">
      <label>Kelas</label>
      <div class="select-wrap"><select id="m-kelas-select">${kelasOptions()}</select></div>
    </div>
    <div class="field">
      <label>Hari</label>
      <div class="select-wrap"><select id="m-day">${dayOptions(activeDay)}</select></div>
    </div>
    <div class="two-col">
      <div class="field">
        <label>Jam mulai</label>
        <input type="text" id="m-start" placeholder="07:00">
      </div>
      <div class="field">
        <label>Jam selesai</label>
        <input type="text" id="m-end" placeholder="08:30">
      </div>
    </div>
    <button class="btn btn-green" onclick="submitTambahJadwal()">Simpan jadwal</button>
  `);
}

async function submitTambahJadwal(){
  const roomId = document.getElementById("m-room").value;
  const kelas = document.getElementById("m-kelas-select").value;
  const day = document.getElementById("m-day").value;
  const start = document.getElementById("m-start").value.trim();
  const end = document.getElementById("m-end").value.trim();

  if(!roomId || !kelas || !start || !end){ showToast("Lengkapi data jadwal terlebih dahulu"); return; }

  const colors = ["#2A5FCE","#1E6B44","#E38B29","#A32D2D","#7B4FCE"];
  const color = colors[STATE.schedules.length % colors.length];

  try{
    await api("/schedules", { method:"POST", body:{ roomId, day, start, end, subject: kelas, teacher: "", color } });
    await api(`/rooms/${roomId}`, { method:"PUT", body:{ kelas, status:"Terpakai" } });
    await refreshState();
    closeModal();
    renderAll();
    showToast("Jadwal baru berhasil disimpan");
  }catch(err){ showToast(err.message); }
}

/* ---------------- Modal: Kelola / Tambah / Hapus Kelas ---------------- */
function openKelolaKelas(){
  openModal(`
    <div class="modal-head">
      <h3>Kelola kelas</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <hr class="modal-hr">
    <div class="add-row">
      <input type="text" id="m-kelas-inline" placeholder="Nama kelas baru">
      <button class="btn btn-orange btn-sm" style="width:auto;padding:12px 16px;" onclick="submitTambahKelasInline()">+ Tambah</button>
    </div>
    <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px;">DAFTAR KELAS</div>
    <div id="kelas-manage-list"></div>
    <button class="btn btn-ghost" style="margin-top:6px;" onclick="closeModal()">Tutup</button>
  `);
  renderKelasManageList();
  document.getElementById("m-kelas-inline").addEventListener("keydown", (e)=>{
    if(e.key === "Enter") submitTambahKelasInline();
  });
}

function renderKelasManageList(){
  const list = document.getElementById("kelas-manage-list");
  if(!list) return;
  list.innerHTML = STATE.kelasList.map(k=>{
    const count = STATE.schedules.filter(s=>s.subject===k).length;
    return `
      <div class="jurusan-manage-item">
        <div class="jm-left">
          <div class="jm-name">${k}</div>
          <div class="jm-count">${count} jadwal memakai kelas ini</div>
        </div>
        <div class="jm-actions">
          <button class="icon-btn del" onclick="openHapusKelas('${k}')">✕</button>
        </div>
      </div>`;
  }).join("") || `<p class="footnote">Belum ada kelas, tambahkan dulu di atas</p>`;
}

async function submitTambahKelasInline(){
  const input = document.getElementById("m-kelas-inline");
  const nama = input.value.trim();
  if(!nama){ showToast("Nama kelas wajib diisi"); return; }
  if(STATE.kelasList.includes(nama)){ showToast("Kelas tersebut sudah ada"); return; }

  try{
    await api("/kelas", { method:"POST", body:{ nama } });
    await refreshState();
    input.value = "";
    renderKelasManageList();
    showToast(`Kelas "${nama}" berhasil ditambahkan`);
  }catch(err){ showToast(err.message); }
}

function openHapusKelas(nama){
  const count = STATE.schedules.filter(s=>s.subject===nama).length;
  openModal(`
    <div class="confirm-icon">!</div>
    <p class="confirm-title">Hapus kelas?</p>
    <p class="confirm-text">Kelas ${nama} akan dihapus dari daftar pilihan.${count > 0 ? ` Kelas ini masih dipakai di ${count} jadwal, tapi jadwal yang sudah ada tidak ikut terhapus.` : ""}</p>
    <div class="confirm-btns">
      <button class="btn btn-outline" onclick="closeModal(); openKelolaKelas();">Batal</button>
      <button class="btn btn-red" onclick="submitHapusKelas('${nama}')">Ya, hapus</button>
    </div>
  `, {center:true});
}

async function submitHapusKelas(nama){
  try{
    await api(`/kelas/${encodeURIComponent(nama)}`, { method:"DELETE" });
    await refreshState();
    closeModal();
    showToast(`Kelas "${nama}" dihapus`);
    openKelolaKelas();
  }catch(err){ showToast(err.message); }
}

/* ---------------- Modal: Kelola / Tambah / Hapus Jurusan ---------------- */
function openKelolaJurusan(){
  openModal(`
    <div class="modal-head">
      <h3>Kelola jurusan</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <hr class="modal-hr">
    <div class="add-row">
      <input type="text" id="m-jurusan-baru" placeholder="Nama jurusan baru" readonly onclick="openTambahJurusan()">
      <button class="btn btn-orange btn-sm" style="width:auto;padding:12px 16px;" onclick="openTambahJurusan()">+ Tambah</button>
    </div>
    <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px;">DAFTAR JURUSAN</div>
    <div id="jurusan-manage-list"></div>
    <button class="btn btn-ghost" style="margin-top:6px;" onclick="closeModal()">Tutup</button>
  `);
  renderJurusanManageList();
}

function renderJurusanManageList(){
  const list = document.getElementById("jurusan-manage-list");
  if(!list) return;
  list.innerHTML = STATE.jurusan.map(j=>{
    const count = STATE.rooms.filter(r=>r.jurusanId===j.id).length;
    return `
      <div class="jurusan-manage-item">
        <div class="jm-left">
          <div class="jm-name">${j.nama}</div>
          <div class="jm-count">${count} kelas terdaftar</div>
        </div>
        <div class="jm-actions">
          <button class="icon-btn del" onclick="openHapusJurusan('${j.id}')">✕</button>
        </div>
      </div>`;
  }).join("");
}

function openTambahJurusan(){
  openModal(`
    <div class="modal-head">
      <h3>Tambah jurusan baru</h3>
      <button class="modal-close" onclick="closeModal(); openKelolaJurusan();">✕</button>
    </div>
    <hr class="modal-hr">
    <div class="field">
      <label>Nama jurusan</label>
      <input type="text" id="m-jurusan-nama" placeholder="Contoh: Multimedia">
    </div>
    <button class="btn btn-orange" onclick="submitTambahJurusan()">Simpan jurusan</button>
  `, {center:true});
}

async function submitTambahJurusan(){
  const input = document.getElementById("m-jurusan-nama");
  const nama = input.value.trim();
  if(!nama){ showToast("Nama jurusan wajib diisi"); return; }

  try{
    await api("/jurusan", { method:"POST", body:{ nama } });
    await refreshState();
    showToast(`Jurusan "${nama}" ditambahkan`);
    closeModal();
    openKelolaJurusan();
    renderJurusanPage();
  }catch(err){ showToast(err.message); }
}

function openHapusJurusan(jurusanId){
  const j = STATE.jurusan.find(x=>x.id===jurusanId);
  if(!j) return;
  const count = STATE.rooms.filter(r=>r.jurusanId===j.id).length;
  openModal(`
    <div class="confirm-icon">!</div>
    <p class="confirm-title">Hapus jurusan?</p>
    <p class="confirm-text">Jurusan ${j.nama} memiliki ${count} kelas terdaftar. Menghapusnya tidak bisa dibatalkan.</p>
    <div class="confirm-btns">
      <button class="btn btn-outline" onclick="closeModal(); openKelolaJurusan();">Batal</button>
      <button class="btn btn-red" onclick="submitHapusJurusan('${j.id}')">Ya, hapus</button>
    </div>
  `, {center:true});
}

async function submitHapusJurusan(jurusanId){
  const j = STATE.jurusan.find(x=>x.id===jurusanId);
  try{
    await api(`/jurusan/${jurusanId}`, { method:"DELETE" });
    await refreshState();
    closeModal();
    renderAll();
    showToast(`Jurusan "${j?j.nama:''}" dihapus`);
    openKelolaJurusan();
  }catch(err){ showToast(err.message); }
}

/* ---------------- Modal: Hasil Pencarian ---------------- */
function openHasilPencarian(query){
  const q = (query||"").toLowerCase().trim();
  const results = q
    ? STATE.rooms.filter(r => r.nama.toLowerCase().includes(q) || (r.kelas||"").toLowerCase().includes(q))
    : STATE.rooms;

  openModal(`
    <div class="modal-head">
      <h3>Hasil pencarian</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <hr class="modal-hr">
    <div class="field">
      <input type="text" id="m-search-live" value="${query||''}" placeholder="Cari ruangan...">
    </div>
    <div style="font-size:10px;font-weight:700;color:var(--muted);margin:14px 0 8px;">DITEMUKAN ${results.length} RUANGAN</div>
    <div id="search-result-list">
      ${results.map(r=>`
        <div class="search-result-item">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--navy-2);margin-bottom:4px;">${r.nama}</div>
            ${roomBadge(r)}
          </div>
          <div class="rmeta">${r.kelas || "—"}</div>
        </div>`).join("") || `<p class="footnote">Tidak ada ruangan ditemukan</p>`}
    </div>
    <button class="btn btn-ghost" style="margin-top:14px;" onclick="closeModal()">Tutup</button>
  `);

  document.getElementById("m-search-live").addEventListener("input", (e)=>{
    const val = e.target.value.toLowerCase().trim();
    const filtered = val
      ? STATE.rooms.filter(r => r.nama.toLowerCase().includes(val) || (r.kelas||"").toLowerCase().includes(val))
      : STATE.rooms;
    document.getElementById("search-result-list").innerHTML = filtered.map(r=>`
        <div class="search-result-item">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--navy-2);margin-bottom:4px;">${r.nama}</div>
            ${roomBadge(r)}
          </div>
          <div class="rmeta">${r.kelas || "—"}</div>
        </div>`).join("") || `<p class="footnote">Tidak ada ruangan ditemukan</p>`;
  });
}

/* ---------------- Dashboard button bindings ---------------- */
document.getElementById("btn-tambah-ruangan").addEventListener("click", openTambahRuangan);
document.getElementById("btn-tambah-jadwal").addEventListener("click", openTambahJadwal);
document.getElementById("btn-kelola-kelas").addEventListener("click", openKelolaKelas);
document.getElementById("btn-kelola-ruangan").addEventListener("click", openKelolaRuangan);
document.getElementById("btn-kelola-jurusan").addEventListener("click", openKelolaJurusan);
document.getElementById("btn-cari").addEventListener("click", ()=>{
  openHasilPencarian(document.getElementById("dash-search").value);
});
document.getElementById("dash-search").addEventListener("keydown", (e)=>{
  if(e.key === "Enter") openHasilPencarian(e.target.value);
});

/* ---------------- Boot ---------------- */
(async function boot(){
  if(getToken()){
    try{
      await goApp();
      return;
    }catch(e){
      setToken(null);
    }
  }
  showView("view-login");
})();
