// ====== KONFIGURASI ======
// TEMPEL URL WEB APP DARI TAHAP 2 DI BAWAH INI
const GAS_URL = "https://script.google.com/macros/s/AKfycbwZ-QBcjXhauPXpKVyyMfAfWln9P_j_woWeMPzf6E0gI8QMfanJKJ3nlK5Xw9-qDmN73g/exec";

// Kategori Data
const categories = {
  Pengeluaran: ["Makan", "Dana Tambahan", "Transportasi", "Internet", "Sedekah", "Laundry", "Hobi", "Perawatan", "Kesehatan", "Pakaian", "Ortu"],
  Pemasukan: ["Suami", "Rejeki"]
};

// Elemen DOM
const tipeRadios = document.querySelectorAll('input[name="tipe"]');
const kategoriSelect = document.getElementById('kategori');
const form = document.getElementById('txForm');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');

let expenseChartInstance = null;
let incomeChartInstance = null;

// Fungsi update dropdown kategori
function updateKategori() {
  const tipe = document.querySelector('input[name="tipe"]:checked').value;
  kategoriSelect.innerHTML = "";
  categories[tipe].forEach(kat => {
    const opt = document.createElement('option');
    opt.value = kat;
    opt.textContent = kat;
    kategoriSelect.appendChild(opt);
  });
}

// Event Listener untuk Radio Tipe
tipeRadios.forEach(radio => radio.addEventListener('change', updateKategori));

// Inisialisasi Kategori saat dimuat
updateKategori();

// Menangani Submit Form (POST ke GAS)
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";

  const payload = {
    Tipe: document.querySelector('input[name="tipe"]:checked').value,
    Kategori: document.getElementById('kategori').value,
    Dompet: document.getElementById('dompet').value,
    Jumlah: document.getElementById('jumlah').value,
    Keterangan: document.getElementById('keterangan').value
  };

  try {
    // Gunakan text/plain untuk menghindari Preflight CORS dari GAS
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain;charset=utf-8" } 
    });
    form.reset();
    updateKategori();
    alert("Transaksi Berhasil Disimpan!");
    fetchAndRenderCharts(); // Refresh grafik
  } catch (error) {
    alert("Terjadi kesalahan. Cek koneksi Anda.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan Transaksi";
  }
});

// Mengambil Data dan Merender Grafik Bulan Ini
async function fetchAndRenderCharts() {
  loading.style.display = "block";
  try {
    const res = await fetch(GAS_URL);
    const json = await res.json();
    if (json.status === "success") {
      processChartData(json.data);
    }
  } catch (error) {
    console.error("Gagal mengambil data", error);
  } finally {
    loading.style.display = "none";
  }
}

function processChartData(data) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let expData = {};
  let incData = {};

  // Filter & Agregasi
  data.forEach(row => {
    const date = new Date(row.Timestamp);
    if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
      if (row.Tipe === "Pengeluaran") {
        expData[row.Kategori] = (expData[row.Kategori] || 0) + Number(row.Jumlah);
      } else {
        incData[row.Kategori] = (incData[row.Kategori] || 0) + Number(row.Jumlah);
      }
    }
  });

  drawChart('expenseChart', expData, 'Pengeluaran', expenseChartInstance, (instance) => expenseChartInstance = instance);
  drawChart('incomeChart', incData, 'Pemasukan', incomeChartInstance, (instance) => incomeChartInstance = instance);
}

function drawChart(canvasId, dataObj, labelStr, chartInstance, setInstance) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const labels = Object.keys(dataObj);
  const data = Object.values(dataObj);

  const newChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.length ? labels : ['Belum ada data'],
      datasets: [{
        label: labelStr,
        data: data.length ? data : [1],
        backgroundColor: labels.length 
          ? ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#34495e', '#7f8c8d', '#d35400', '#c0392b']
          : ['#ecf0f1'] // Warna abu jika kosong
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
  setInstance(newChart);
}

// Inisialisasi Grafik
fetchAndRenderCharts();

// PWA: Registrasi Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW Registered'))
      .catch(err => console.error('SW Failed', err));
  });
}
