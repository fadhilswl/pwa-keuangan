const GAS_URL = "https://script.google.com/macros/s/AKfycbwZ-QBcjXhauPXpKVyyMfAfWln9P_j_woWeMPzf6E0gI8QMfanJKJ3nlK5Xw9-qDmN73g/exec";

// Database Kategori & Dompet Default
const defaultCategories = {
  Pengeluaran: ["Makan", "Dana Tambahan", "Transportasi", "Internet", "Sedekah", "Laundry", "Hobi", "Perawatan", "Kesehatan", "Pakaian", "Ortu", "Penyesuaian Saldo"],
  Pemasukan: ["Suami", "Rejeki", "Penyesuaian Saldo"],
  Transfer: ["Mutasi"]
};
const defaultWallets = ["Cash", "Bank"];

// Load data kustom dari LocalStorage agar awet saat PWA ditutup
let customCategories = JSON.parse(localStorage.getItem('customCategories')) || { Pengeluaran: [], Pemasukan: [] };
let customWallets = JSON.parse(localStorage.getItem('customWallets')) || [];
let allData = [];

let expenseChartInstance = null;
let incomeChartInstance = null;

// Elemen DOM
const form = document.getElementById('txForm');
const submitBtn = document.getElementById('submitBtn');
const filterBulan = document.getElementById('filterBulan');
const walletContainer = document.getElementById('walletContainer');

// Set Default Bulan Ini
const now = new Date();
filterBulan.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// ====== FITUR EFEK SUARA (Web Audio API Synthesizer) ======
function playSound(type) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'success') {
    // Suara Beep Ganda Ceria
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } else if (type === 'delete') {
    // Suara Bass Menurun
    osc.frequency.setValueAtTime(220.00, ctx.currentTime); // A3
    osc.frequency.setValueAtTime(146.83, ctx.currentTime + 0.1); // D3
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }
}

// ====== LOGIKA RENDER DINAMIS DROPDOWN ======
function updateDropdownOptions() {
  const tipe = document.querySelector('input[name="tipe"]:checked').value;
  
  // Ambil gabungan default + kustom
  const mats = [...defaultCategories[tipe], ...(customCategories[tipe] || [])];
  const wallets = [...defaultWallets, ...customWallets];

  // Render Kategori
  const katSelect = document.getElementById('kategori');
  katSelect.innerHTML = "";
  mats.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = k;
    katSelect.appendChild(opt);
  });

  // Render Dompet Asal
  const dompetSelect = document.getElementById('dompet');
  dompetSelect.innerHTML = "";
  wallets.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w; opt.textContent = w;
    dompetSelect.appendChild(opt);
  });

  // Render Dompet Tujuan (Khusus Transfer)
  const transferGroup = document.getElementById('transferGroup');
  const dompetKeSelect = document.getElementById('dompetKe');
  if (tipe === "Transfer") {
    transferGroup.style.display = "block";
    document.getElementById('labelDompetDari').textContent = "Dari Dompet";
    dompetKeSelect.innerHTML = "";
    wallets.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w; opt.textContent = w;
      dompetKeSelect.appendChild(opt);
    });
  } else {
    transferGroup.style.display = "none";
    document.getElementById('labelDompetDari').textContent = "Dompet";
  }
}
document.querySelectorAll('input[name="tipe"]').forEach(r => r.addEventListener('change', updateDropdownOptions));

// ====== ENGINE KALKULASI & MANAGEMENT DOMPET DENGAN EDIT SALDO ======
function calculateBalances() {
  const wallets = [...defaultWallets, ...customWallets];
  let saldoMap = {};
  wallets.forEach(w => saldoMap[w] = 0);

  allData.forEach(row => {
    const jml = Number(row.Jumlah);
    if (row.Tipe === "Pemasukan" && saldoMap[row.Dompet] !== undefined) {
      saldoMap[row.Dompet] += jml;
    } else if (row.Tipe === "Pengeluaran" && saldoMap[row.Dompet] !== undefined) {
      saldoMap[row.Dompet] -= jml;
    } else if (row.Tipe === "Transfer") {
      const [dari, ke] = row.Dompet.split(" -> ");
      if (saldoMap[dari] !== undefined) saldoMap[dari] -= jml;
      if (saldoMap[ke] !== undefined) saldoMap[ke] += jml;
    }
  });

  // Render Wallet Cards ke HTML
  walletContainer.innerHTML = "";
  wallets.forEach(w => {
    const typeClass = w.toLowerCase() === 'cash' ? 'cash' : (w.toLowerCase() === 'bank' ? 'bank' : 'custom');
    const formattedSaldo = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(saldoMap[w]);
    
    const div = document.createElement('div');
    div.className = `wallet-card ${typeClass}`;
    div.innerHTML = `
      <p>${w}</p>
      <h3>${formattedSaldo}</h3>
      <div class="wallet-actions">
        <button class="btn-action" onclick="editSaldoLangsung('${w}', ${saldoMap[w]})">Edit</button>
      </div>
    `;
    walletContainer.appendChild(div);
  });
}

// Fitur Edit Jumlah Saldo Langsung (Melalui Sistem Auto-Adjustment Ledger ke Spreadsheet)
async function editSaldoLangsung(walletName, currentSaldo) {
  const inputTarget = prompt(`Masukkan jumlah target saldo baru untuk [ ${walletName} ] :`, currentSaldo);
  if (inputTarget === null || inputTarget === "") return;
  
  const targetSaldo = Number(inputTarget);
  if (isNaN(targetSaldo)) return alert("Mohon masukkan angka valid.");

  const selisih = targetSaldo - currentSaldo;
  if (selisih === 0) return;

  const tipeAdj = selisih > 0 ? "Pemasukan" : "Pengeluaran";
  const jumlahAdj = Math.abs(selisih);

  document.getElementById('loading').style.display = "block";
  try {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "insert",
        Tipe: tipeAdj,
        Kategori: "Penyesuaian Saldo",
        Dompet: walletName,
        Jumlah: jumlahAdj,
        Keterangan: "Edit Saldo Langsung via Aplikasi"
      }),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    playSound('success');
    alert(`Saldo ${walletName} berhasil disesuaikan!`);
    fetchDatabase();
  } catch (e) {
    alert("Gagal memperbarui saldo di Spreadsheet.");
  }
}

// ====== PENGATURAN TAMBAH KATEGORI DAN DOMPET KUSTOM ======
window.tambahKategoriKustom = function() {
  const tipe = document.getElementById('addKatTipe').value;
  const name = document.getElementById('newKatName').value.trim();
  if(!name) return;
  customCategories[tipe].push(name);
  localStorage.setItem('customCategories', JSON.stringify(customCategories));
  document.getElementById('newKatName').value = "";
  updateDropdownOptions();
  alert(`Kategori ${name} berhasil ditambahkan!`);
};

window.tambahDompetKustom = function() {
  const name = document.getElementById('newWalletName').value.trim();
  if(!name) return;
  customWallets.push(name);
  localStorage.setItem('customWallets', JSON.stringify(customWallets));
  document.getElementById('newWalletName').value = "";
  updateDropdownOptions();
  calculateBalances();
  alert(`Dompet ${name} berhasil ditambahkan!`);
};

// ====== ENGINE RENDER VIEW & CHARTS ======
async function fetchDatabase() {
  document.getElementById('loading').style.display = "block";
  try {
    const res = await fetch(GAS_URL);
    const json = await res.json();
    if (json.status === "success") {
      allData = json.data;
      calculateBalances();
      renderFilteredReport();
    }
  } catch (e) { console.error(e); }
  document.getElementById('loading').style.display = "none";
}

function renderFilteredReport() {
  const [fYear, fMonth] = filterBulan.value.split("-");
  const filteredData = allData.filter(row => {
    const d = new Date(row.Timestamp);
    return d.getFullYear() == fYear && (d.getMonth() + 1) == fMonth;
  });

  // Render Tabel Riwayat
  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = "";
  [...filteredData].reverse().forEach(row => {
    const tr = document.createElement('tr');
    const d = new Date(row.Timestamp);
    let tCls = row.Tipe === "Pengeluaran" ? "text-red" : (row.Tipe === "Pemasukan" ? "text-green" : "text-blue");
    const fmtJml = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(row.Jumlah);

    tr.innerHTML = `
      <td>${d.getDate()}/${d.getMonth()+1}</td>
      <td class="${tCls}">${row.Tipe}</td>
      <td>${row.Dompet}</td>
      <td>${row.Kategori}</td>
      <td>${fmtJml}</td>
      <td><button class="delete-btn" onclick="hapusRow(${row.rowNumber})">Hapus</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Render Charts
  let expData = {}, incData = {};
  filteredData.forEach(row => {
    if (row.Tipe === "Pengeluaran") expData[row.Kategori] = (expData[row.Kategori] || 0) + Number(row.Jumlah);
    if (row.Tipe === "Pemasukan") incData[row.Kategori] = (incData[row.Kategori] || 0) + Number(row.Jumlah);
  });
  buildChart('expenseChart', expData, expenseChartInstance, inst => expenseChartInstance = inst);
  buildChart('incomeChart', incData, incomeChartInstance, inst => incomeChartInstance = inst);
}
filterBulan.addEventListener('change', renderFilteredReport);

function buildChart(canvasId, dataObj, instance, setInst) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if(instance) instance.destroy();
  const labels = Object.keys(dataObj);
  const vals = Object.values(dataObj);

  const chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.length ? labels : ['Kosong'],
      datasets: [{
        data: vals.length ? vals : [1],
        backgroundColor: labels.length ? ['#ff4757', '#54a0ff', '#ff9f43', '#2ed573', '#9b59b6', '#ff79c6', '#1abc9c', '#f1c40f'] : ['#25283d'],
        borderWidth: 0
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#fff', font: { size: 10 } } } } }
  });
  setInst(chart);
}

// ====== FORM HANDLING SUBMIT & DELETE ======
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const tipe = document.querySelector('input[name="tipe"]:checked').value;
  let dompetVal = document.getElementById('dompet').value;

  if (tipe === "Transfer") {
    const ke = document.getElementById('dompetKe').value;
    if (dompetVal === ke) return alert("Dompet asal dan tujuan tidak boleh sama!");
    dompetVal = `${dompetVal} -> ${ke}`;
  }

  submitBtn.disabled = true;
  try {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "insert", Tipe: tipe, Kategori: document.getElementById('kategori').value,
        Dompet: dompetVal, Jumlah: document.getElementById('jumlah').value, Keterangan: document.getElementById('keterangan').value
      }),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    playSound('success');
    form.reset();
    updateDropdownOptions();
    fetchDatabase();
  } catch(err) { alert("Gagal menyimpan data."); }
  submitBtn.disabled = false;
});

window.hapusRow = async function(rowNumber) {
  if(!confirm("Hapus data transaksi ini?")) return;
  try {
    document.getElementById('loading').style.display = "block";
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete", rowNumber: rowNumber }),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    playSound('delete');
    fetchDatabase();
  } catch(e) { alert("Gagal menghapus."); }
};

// Init awal aplikasi
updateDropdownOptions();
fetchDatabase();
