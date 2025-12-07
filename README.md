<div align="center">

# 📸 imupscaller

### Alat Pengubah Ukuran Cetak dan Peningkatan Skala (300 DPI)

Siapkan gambar Anda untuk pencetakan profesional dengan mudah dan cepat.

[![React](https://img.shields.io/badge/React-18.2+-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-4.3+-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3+-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

[Try Me!](https://image-upscaller.vercel.app) • [Fitur](#-fitur-utama) • [Instalasi](#-instalasi) • [Deployment](#-deployment) • [Kontribusi](#-kontribusi)

</div>

---

## 📝 Tentang Aplikasi

**imupscaller** adalah aplikasi web modern berbasis React yang dirancang untuk memudahkan Anda menyiapkan file gambar untuk pencetakan profesional. 

Aplikasi ini:
- ✅ Mengambil gambar sumber apa pun
- ✅ Secara otomatis mendeteksi orientasi (Potret atau Lanskap)
- ✅ Mengkonversinya menjadi standar ukuran cetak dengan resolusi 300 DPI

**Keamanan & Privasi:** Seluruh pemrosesan dilakukan di browser (sisi klien). Data Anda tetap aman dan tidak ada beban pemrosesan pada server eksternal.

## ✨ Fitur Utama

### 🖼️ Pemrosesan Gambar Tingkat Lanjut
- **Pemrosesan Sisi Klien Penuh** - Semua pemrosesan (pengubahan ukuran, penskalaan, kompresi) dilakukan di perangkat Anda
- **Kualitas Profesional** - Standar cetak 300 DPI untuk hasil terbaik
- **Deteksi Orientasi Otomatis** - Secara cerdas menyesuaikan dimensi target (Potret/Lanskap)

### 📐 Standar Ukuran Cetak
Mendukung berbagai ukuran cetak populer:
- **Inci:** 5×7, 8×10, 9×12, 11×14, 16×20, 18×24, 24×36
- **Metrik:** A2 (420 × 594 mm)

### 🎯 Fitur Tambahan
- **Pemberian Nama File Kustom** - Atur prefix untuk semua file output (contoh: `[Nama]_8x10in.jpg`)
- **Unduh Batch ZIP** - Download semua ukuran dalam satu file ZIP
- **Pratinjau Real-time** - Lihat hasil sebelum download
- **Tidak Ada Upload Server** - Privasi data terjamin

## 🚀 Teknologi yang Digunakan

| Teknologi | Deskripsi | Link |
|-----------|-----------|------|
| **React** | Library UI modern | [react.dev](https://react.dev) |
| **Vite** | Build tool super cepat | [vitejs.dev](https://vitejs.dev) |
| **Tailwind CSS** | Styling utility-first | [tailwindcss.com](https://tailwindcss.com) |
| **Lucide React** | Icon library cantik | [lucide.dev](https://lucide.dev) |
| **Canvas API** | Pemrosesan gambar native | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) |
| **JSZip** | Batch download ZIP | [stuk/jszip](https://github.com/Stuk/jszip) |

## ⚡ Instalasi & Menjalankan Lokal

### Prasyarat
- Node.js versi 16+ ([Download](https://nodejs.org/))
- npm atau yarn

### Langkah-langkah

**1. Clone Repository**
```bash
git clone https://github.com/yourusername/Upscaller.git
cd Upscaller
```

**2. Instal Dependencies**
```bash
npm install
```

**3. Jalankan Development Server**
```bash
npm run dev
```

Aplikasi akan terbuka di `http://localhost:5173`

**4. Build untuk Production**
```bash
npm run build
```

Output akan berada di folder `dist/`

### Script Tersedia
```bash
npm run dev      # Jalankan development server
npm run build    # Build untuk production
npm run preview  # Preview production build
```

---

## 📁 Struktur Folder

```
Upscaller/
├── src/
│   ├── App.jsx              # Komponen utama aplikasi
│   ├── main.jsx             # Entry point React
│   └── index.css            # Global styles
├── index.html               # Template HTML
├── package.json             # Dependencies & scripts
├── vite.config.js           # Konfigurasi Vite
├── vercel.json              # Konfigurasi Vercel
├── tailwind.config.js       # Konfigurasi Tailwind
├── postcss.config.js        # Konfigurasi PostCSS
├── README.md                # File ini
├── DEPLOYMENT.md            # Panduan deployment detail
└── .gitignore               # Git ignore rules
```

---

## 💡 Cara Menggunakan

### 1. Upload Gambar
Klik area upload atau drag-drop gambar Anda. Format yang didukung: JPEG, PNG, WebP, TIFF.

### 2. Atur Nama File
Masukkan prefix nama file (contoh: "Potret_Keluarga"). File output akan dinamakan:
- `Potret_Keluarga_5x7in.jpg`
- `Potret_Keluarga_8x10in.jpg`
- dst...

### 3. Pilih Ukuran & Download
- Pilih ukuran cetak yang diinginkan
- Pratinjau hasil
- Download individual atau batch ZIP

### 4. Tips Kualitas
- Gunakan gambar sumber beresolusi tinggi (minimal 2000×3000 pixel)
- Format RGB untuk hasil terbaik
- Semua output akan dalam standar 300 DPI

---

## 📄 Lisensi

MIT License - Silakan gunakan untuk proyek pribadi dan komersial.

---

<div align="center">

**Made with ❤️ untuk fotografer dan printer profesional**

[⬆ Kembali ke Atas](#-imupscaller)

</div>
