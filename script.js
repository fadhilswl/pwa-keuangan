const GAS_URL = "https://script.google.com/macros/s/AKfycbwZ-QBcjXhauPXpKVyyMfAfWln9P_j_woWeMPzf6E0gI8QMfanJKJ3nlK5Xw9-qDmN73g/exec";

// ====== THEME MANAGEMENT ======
function setTheme(themeName) {
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('appTheme', themeName);
}
// Load Theme saat aplikasi dibuka
const savedTheme = localStorage.getItem('appTheme') || 'dark';
setTheme(savedTheme);

// ====== STATE MANAGEMENT ======
let appCategories = JSON.parse(localStorage.getItem('appCategories')) || {
  Pengeluaran: ["Makan", "Dana Tambahan", "Transportasi", "Internet", "Sedekah", "Laundry", "Hobi", "Perawatan", "Kesehatan", "Pakaian", "Ortu"],
  Pemasukan: ["Suami", "Rejeki"],
  Transfer: ["Mutasi"]
};
let appWallets = JSON.parse(localStorage.getItem('appWallets')) || ["Cash", "Bank"];

function saveConfig() {
  localStorage.setItem('appCategories', JSON.stringify(appCategories));
  localStorage.setItem('appWallets', JSON.stringify(appWallets));
  updateDropdownOptions();
  renderManageLists();
  if (allData.length > 0) calculateBalances();
}

let allData = [];
let expenseChartInstance = null;
let incomeChartInstance = null;
const form = document.getElementById('txForm');
const submitBtn = document.getElementById('submitBtn');
const filterBulan = document.getElementById('filterBulan');
const walletContainer = document.getElementById('walletContainer');

const now = new Date();
filterBulan.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

function playSound(type) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  if (type === 'success') {
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.05, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
  } else if (type === 'delete') {
    osc.frequency.setValueAtTime(220.00, ctx.currentTime); osc.frequency.setValueAtTime(146.83, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  }
}

function updateDropdownOptions() {
  const tipe = document.querySelector('input[name="tipe"]:checked').value;
  const katSelect = document.getElementById('kategori');
  katSelect.innerHTML = "";
  (appCategories[tipe] || []).forEach(k => {
    const opt = document.createElement('option'); opt.value = k; opt.textContent = k; katSelect.appendChild(opt);
  });

  const dompetSelect = document.getElementById('dompet');
  dompetSelect.innerHTML = "";
  appWallets.forEach(w => {
    const opt = document.createElement('option'); opt.value = w; opt.textContent = w; dompetSelect.appendChild(opt);
  });

  const transferGroup = document.getElementById('transferGroup');
  const dompetKeSelect = document.getElementById('dompetKe');
  if (tipe === "Transfer") {
    transferGroup.style.display = "block"; document.getElementById('labelDompetDari').textContent = "Dari Dompet";
    dompetKeSelect.innerHTML = "";
    appWallets.forEach(w => {
      const opt = document.createElement('option'); opt.value = w; opt.textContent = w; dompetKeSelect.appendChild(opt);
    });
  } else {
    transferGroup.style.display = "none"; document.getElementById('labelDompetDari').textContent = "Dompet";
  }
}
document.querySelectorAll('input[name="tipe"]').forEach(r => r.addEventListener('change', updateDropdownOptions));

function renderManageLists() {
  const tipeKat = document.getElementById('manageKatTipe').value;
  const katListDiv = document.getElementById('manageKatList');
  katListDiv.innerHTML = "";
  (appCategories[tipeKat] || []).forEach((kat, index) => {
    const badge = document.createElement('div'); badge.className = 'badge';
    badge.innerHTML = `<span>${kat}</span> <button onclick="hapusKategori('${tipeKat}', ${index})">×</button>`; katListDiv.appendChild(badge);
  });

  const walletListDiv = document.getElementById('manageWalletList');
  walletListDiv.innerHTML = "";
  appWallets.forEach((w, index) => {
    const badge = document.createElement('div'); badge.className = 'badge';
    badge.innerHTML = `<span>${w}</span> <button onclick="hapusDompet(${index})">×</button>`; walletListDiv.appendChild(badge);
  });
}

window.tambahKategori = function() {
  const tipe = document.getElementById('manageKatTipe').value; const val = document.getElementById('newKatName').value.trim();
  if (val && !appCategories[tipe].includes(val)) { appCategories[tipe].push(val); document.getElementById('newKatName').value = ""; saveConfig(); }
}
window.hapusKategori = function(tipe, index) { if (confirm("Hapus kategori ini?")) { appCategories[tipe].splice(index, 1); saveConfig(); } }
window.tambahDompet = function() {
  const val = document.getElementById('newWalletName').value.trim();
  if (val && !appWallets.includes(val)) { appWallets.push(val); document.getElementById('newWalletName').value = ""; saveConfig(); }
}
window.hapusDompet = function(index) { if (confirm("Hapus dompet ini?")) { appWallets.splice(index, 1); saveConfig(); } }

function calculateBalances() {
  let saldoMap = {}; appWallets.forEach(w => saldoMap[w] = 0);
  allData.forEach(row => {
    const jml = Number(row.Jumlah);
    if (row.Tipe === "Pemasukan" && saldoMap[row.Dompet] !== undefined) saldoMap[row.Dompet] += jml;
    else if (row.Tipe === "Pengeluaran" && saldoMap[row.Dompet] !== undefined) saldoMap[row.Dompet] -= jml;
    else if (row.Tipe === "Transfer") {
      const [dari, ke] = row.Dompet.split(" -> ");
      if (saldoMap[dari] !== undefined) saldoMap[dari] -= jml;
      if (saldoMap[ke] !== undefined) saldoMap[ke] += jml;
    }
  });

  walletContainer.innerHTML = "";
  appWallets.forEach(w => {
    const typeClass = w.toLowerCase() === 'cash' ? 'cash' : (w.toLowerCase() === 'bank' ? 'bank' : 'custom');
    const div = document.createElement('div'); div.className = `wallet-card ${typeClass}`;
    div.innerHTML = `<p>${w}</p><h3>${formatRp(saldoMap[w] || 0)}</h3>`; walletContainer.appendChild(div);
  });
}

async function fetchDatabase() {
  document.getElementById('loading').style.display = "block";
  try {
    const res = await fetch(GAS_URL); const json = await res.json();
    if (json.status === "success") { allData = json.data; calculateBalances(); renderFilteredReport(); }
  } catch (e) { console.error(e); }
  document.getElementById('loading').style.display = "none";
}

function renderFilteredReport() {
  const [fYear, fMonth] = filterBulan.value.split("-");
  const filteredData = allData.filter(row => {
    const d = new Date(row.Timestamp); return d.getFullYear() == fYear && (d.getMonth() + 1) == fMonth;
  });

  // Kalkulasi Summary Laporan
  let totalIncome = 0; let totalExpense = 0;
  let expData = {}, incData = {};

  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = "";
  
  [...filteredData].reverse().forEach(row => {
    const tr = document.createElement('tr');
    const d = new Date(row.Timestamp);
    
    // Pewarnaan Baris Penuh Berdasar Tipe
    if(row.Tipe === "Pengeluaran") {
      tr.className = "row-expense";
      totalExpense += Number(row.Jumlah);
      expData[row.Kategori] = (expData[row.Kategori] || 0) + Number(row.Jumlah);
    } else if(row.Tipe === "Pemasukan") {
      tr.className = "row-income";
      totalIncome += Number(row.Jumlah);
      incData[row.Kategori] = (incData[row.Kategori] || 0) + Number(row.Jumlah);
    } else {
      tr.className = "row-transfer";
    }

    tr.innerHTML = `
      <td>${d.getDate()}/${d.getMonth()+1}</td>
      <td>${row.Tipe}</td>
      <td>${row.Dompet}</td>
      <td>${row.Kategori}</td>
      <td>${formatRp(row.Jumlah)}</td>
      <td>${row.Keterangan || '-'}</td>
      <td><button class="delete-btn" onclick="hapusRow(${row.rowNumber})">Hapus</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Render Angka Summary Laporan
  document.getElementById('repIncome').textContent = formatRp(totalIncome);
  document.getElementById('repExpense').textContent = formatRp(totalExpense);
  
  const totalSisa = totalIncome - totalExpense;
  const elTotal = document.getElementById('repTotal');
  elTotal.textContent = formatRp(totalSisa);
  elTotal.className = totalSisa < 0 ? 'text-red' : (totalSisa > 0 ? 'text-green' : '');

  buildChart('expenseChart', expData, expenseChartInstance, inst => expenseChartInstance = inst);
  buildChart('incomeChart', incData, incomeChartInstance, inst => incomeChartInstance = inst);
}
filterBulan.addEventListener('change', renderFilteredReport);

function buildChart(canvasId, dataObj, instance, setInst) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if(instance) instance.destroy();
  const labels = Object.keys(dataObj); const vals = Object.values(dataObj);
  const chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.length ? labels : ['Kosong'],
      datasets: [{ data: vals.length ? vals : [1], backgroundColor: labels.length ? ['#ff4757', '#54a0ff', '#ff9f43', '#2ed573', '#9b59b6', '#ff79c6', '#1abc9c', '#f1c40f'] : ['#25283d'], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: getComputedStyle(document.body).getPropertyValue('--text-main'), font: { family: 'Fredoka', size: 11 } } } } }
  });
  setInst(chart);
}

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
      body: JSON.stringify({ action: "insert", Tipe: tipe, Kategori: document.getElementById('kategori').value, Dompet: dompetVal, Jumlah: document.getElementById('jumlah').value, Keterangan: document.getElementById('keterangan').value }),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    playSound('success'); form.reset(); updateDropdownOptions(); fetchDatabase();
  } catch(err) { alert("Gagal menyimpan data."); }
  submitBtn.disabled = false;
});

window.hapusRow = async function(rowNumber) {
  if(!confirm("Hapus data transaksi ini?")) return;
  try {
    document.getElementById('loading').style.display = "block";
    await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "delete", rowNumber: rowNumber }), headers: { "Content-Type": "text/plain;charset=utf-8" } });
    playSound('delete'); fetchDatabase();
  } catch(e) { alert("Gagal menghapus."); }
};

// INIT
updateDropdownOptions(); renderManageLists(); fetchDatabase();
