// ====== GANTI DENGAN URL WEB APP TERBARU ANDA ======
const GAS_URL = "https://script.google.com/macros/s/AKfycbwZ-QBcjXhauPXpKVyyMfAfWln9P_j_woWeMPzf6E0gI8QMfanJKJ3nlK5Xw9-qDmN73g/exec";

// Kategori Data (Ditambah Mutasi untuk Transfer)
const categories = {
  Pengeluaran: ["Makan", "Dana Tambahan", "Transportasi", "Internet", "Sedekah", "Laundry", "Hobi", "Perawatan", "Kesehatan", "Pakaian", "Ortu"],
  Pemasukan: ["Suami", "Rejeki"],
  Transfer: ["Mutasi"]
};

// State Aplikasi
let allData = []; // Menyimpan semua data agar tidak perlu fetch berulang kali
let expenseChartInstance = null;
let incomeChartInstance = null;

// Elemen DOM
const tipeRadios = document.querySelectorAll('input[name="tipe"]');
const kategoriSelect = document.getElementById('kategori');
const form = document.getElementById('txForm');
const submitBtn = document.getElementById('submitBtn');
const transferGroup = document.getElementById('transferGroup');
const labelDompetDari = document.getElementById('labelDompetDari');
const filterBulan = document.getElementById('filterBulan');
const loading = document.getElementById('loading');

// Format Rupiah Helper
const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

// 1. Set Default Filter Bulan (Bulan Ini)
const now = new Date();
const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
filterBulan.value = currentMonthStr;

// 2. Logika Dropdown Dinamis
function updateKategori() {
  const tipe = document.querySelector('input[name="tipe"]:checked').value;
  
  // Tampilkan/Sembunyikan Opsi Transfer
  if (tipe === "Transfer") {
    transferGroup.style.display = "block";
    labelDompetDari.textContent = "Dari Dompet";
  } else {
    transferGroup.style.display = "none";
    labelDompetDari.textContent = "Dompet / Akun";
  }

  // Update Kategori
  kategoriSelect.innerHTML = "";
  categories[tipe].forEach(kat => {
    const opt = document.createElement('option');
    opt.value = kat;
    opt.textContent = kat;
    kategoriSelect.appendChild(opt);
  });
}
tipeRadios.forEach(radio => radio.addEventListener('change', updateKategori));
updateKategori(); // Init

// 3. Ambil Data dari API
async function fetchData() {
  loading.style.display = "block";
  try {
    const res = await fetch(GAS_URL);
    const json = await res.json();
    if (json.status === "success") {
      allData = json.data;
      calculateGlobalBalances();
      renderFilteredView();
    }
  } catch (error) {
    console.error("Gagal mengambil data", error);
  } finally {
    loading.style.display = "none";
  }
}

// 4. Hitung Saldo Keseluruhan (Dari Awal Pencatatan)
function calculateGlobalBalances() {
  let saldo = { "Cash": 0, "Bank Jago": 0 };
  
  allData.forEach(row => {
    const jml = Number(row.Jumlah);
    if (row.Tipe === "Pemasukan" && saldo[row.Dompet] !== undefined) {
      saldo[row.Dompet] += jml;
    } else if (row.Tipe === "Pengeluaran" && saldo[row.Dompet] !== undefined) {
      saldo[row.Dompet] -= jml;
    } else if (row.Tipe === "Transfer") {
      const [dari, ke] = row.Dompet.split(" -> ");
      if (saldo[dari] !== undefined) saldo[dari] -= jml;
      if (saldo[ke] !== undefined) saldo[ke] += jml;
    }
  });

  document.getElementById('saldoCash').textContent = formatRp(saldo["Cash"]);
  document.getElementById('saldoJago').textContent = formatRp(saldo["Bank Jago"]);
}

// 5. Render Data Berdasarkan Filter Bulan
function renderFilteredView() {
  const [fYear, fMonth] = filterBulan.value.split("-");
  
  const filteredData = allData.filter(row => {
    const d = new Date(row.Timestamp);
    return d.getFullYear() == fYear && (d.getMonth() + 1) == fMonth;
  });

  processChartData(filteredData);
  renderHistoryTable(filteredData);
}

// Event Listener Filter Bulan
filterBulan.addEventListener('change', renderFilteredView);

// 6. Grafik Data
function processChartData(data) {
  let expData = {};
  let incData = {};

  data.forEach(row => {
    if (row.Tipe === "Pengeluaran") expData[row.Kategori] = (expData[row.Kategori] || 0) + Number(row.Jumlah);
    if (row.Tipe === "Pemasukan") incData[row.Kategori] = (incData[row.Kategori] || 0) + Number(row.Jumlah);
  });

  drawChart('expenseChart', expData, 'Pengeluaran', expenseChartInstance, (inst) => expenseChartInstance = inst);
  drawChart('incomeChart', incData, 'Pemasukan', incomeChartInstance, (inst) => incomeChartInstance = inst);
}

function drawChart(canvasId, dataObj, labelStr, chartInstance, setInstance) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const labels = Object.keys(dataObj);
  const data = Object.values(dataObj);

  const newChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.length ? labels : ['Kosong'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: labels.length 
          ? ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#34495e', '#7f8c8d']
          : ['#ecf0f1']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
  setInstance(newChart);
}

// 7. Tabel Riwayat
function renderHistoryTable(data) {
  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = "";

  // Urutkan data dari yang terbaru ke terlama
  const sortedData = [...data].reverse();

  sortedData.forEach(row => {
    const tr = document.createElement('tr');
    
    // Format Tanggal
    const d = new Date(row.Timestamp);
    const dateStr = `${d.getDate()}/${d.getMonth()+1}`;

    // Warna Teks berdasar Tipe
    let tipeClass = "";
    if(row.Tipe === "Pengeluaran") tipeClass = "text-red";
    if(row.Tipe === "Pemasukan") tipeClass = "text-green";
    if(row.Tipe === "Transfer") tipeClass = "text-blue";

    tr.innerHTML = `
      <td>${dateStr}</td>
      <td class="${tipeClass}">${row.Tipe}</td>
      <td>${row.Dompet}</td>
      <td>${row.Kategori}</td>
      <td>${formatRp(row.Jumlah)}</td>
      <td><button class="delete-btn" onclick="hapusTransaksi(${row.rowNumber})">Hapus</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// 8. Menangani Submit Form Baru
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const tipe = document.querySelector('input[name="tipe"]:checked').value;
  let dompetVal = document.getElementById('dompet').value;
  
  // Validasi khusus Transfer
  if (tipe === "Transfer") {
    const keDompet = document.getElementById('dompetKe').value;
    if (dompetVal === keDompet) {
      alert("Dompet asal dan tujuan tidak boleh sama!");
      return;
    }
    dompetVal = `${dompetVal} -> ${keDompet}`; // Format khusus transfer
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";

  const payload = {
    action: "insert",
    Tipe: tipe,
    Kategori: document.getElementById('kategori').value,
    Dompet: dompetVal,
    Jumlah: document.getElementById('jumlah').value,
    Keterangan: document.getElementById('keterangan').value
  };

  try {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain;charset=utf-8" } 
    });
    form.reset();
    updateKategori();
    alert("Berhasil Disimpan!");
    fetchData(); // Refresh Data dari backend
  } catch (error) {
    alert("Error menyimpan data.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan Transaksi";
  }
});

// 9. Menangani Hapus Transaksi
async function hapusTransaksi(rowNumber) {
  if (!confirm("Yakin ingin menghapus transaksi ini?")) return;

  try {
    loading.style.display = "block";
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete", rowNumber: rowNumber }),
      headers: { "Content-Type": "text/plain;charset=utf-8" } 
    });
    alert("Transaksi dihapus.");
    fetchData(); // Refresh Data
  } catch (error) {
    alert("Gagal menghapus data.");
    loading.style.display = "none";
  }
}

// Inisialisasi awal
fetchData();

// PWA Service Worker (Biarkan ini ada di baris terbawah)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
