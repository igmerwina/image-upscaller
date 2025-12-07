# PrintResizer: Alat Pengubah Ukuran Cetak dan Peningkatan Skala (300 DPI)

PrintResizer adalah aplikasi client-side berbasis React yang dirancang
untuk secara cepat dan mudah menyiapkan file gambar Anda untuk
pencetakan profesional. Aplikasi ini mengambil gambar sumber apa pun,
secara otomatis mendeteksi orientasi (Potret atau Lanskap), dan
mengkonversinya menjadi satu set standar ukuran cetak resolusi tinggi
(300 DPI).

Karena seluruh pemrosesan dilakukan di browser (sisi klien), privasi
data Anda terjamin, dan tidak ada beban pemrosesan yang ditempatkan pada
server eksternal.

## ✨ Fitur Utama

-   **Pemrosesan Sisi Klien Penuh:** Semua pemrosesan gambar (pengubahan
    ukuran, penskalaan, dan kompresi) dilakukan di perangkat pengguna.
    Tidak ada unggahan ke server.
-   **Standar Cetak 300 DPI:** Semua file output dikodekan dengan
    metadata 300 DPI wajib untuk memastikan pengakuan kualitas cetak
    profesional.
-   **Deteksi Orientasi Otomatis:** Secara cerdas membalik dimensi
    target (Potret/Lanskap) agar sesuai dengan orientasi gambar sumber
    Anda.
-   **Ukuran Cetak Standar:** Membuat salinan siap cetak untuk ukuran
    cetak paling umum:
    -   **Inci:** 5x7, 8x10, 9x12, 11x14, 16x20, 18x24, 24x36\
    -   **Metrik:** A2 (420 x 594 mm)
-   **Pemberian Nama File Kustom:** Anda dapat menentukan awalan file
    (prefix) yang akan digunakan untuk semua file output, misalnya:
    `[JudulAnda]_8x10in.jpg` atau `[JudulAnda]_A2.jpg`.
-   **Opsi Unduh Batch:** Unduh semua ukuran dan file asli (300 DPI)
    dalam satu file ZIP.

## 🚀 Teknologi yang Digunakan

-   **Frontend:** React (JSX)
-   **Styling:** Tailwind CSS (kelas sebaris)
-   **Image Processing:** HTML Canvas API (untuk pengubahan ukuran dan
    resampling)
-   **Batch Download:** JSZip (dimuat secara dinamis)

## 🛠️ Pengembangan & Deployment

Proyek ini dibangun sebagai aplikasi satu file komponen React. Untuk
mendeploy-nya, disarankan untuk mengemasnya menggunakan bundler seperti
Vite.

### Menjalankan Secara Lokal (Menggunakan Vite)

#### 1. Buat Proyek Vite:

    npm create vite@latest printresizer-app -- --template react
    cd printresizer-app

#### 2. Ganti File:

Ganti konten `src/App.jsx` dengan kode aplikasi PrintResizer ini.

#### 3. Instal Dependensi:

    npm install

#### 4. Jalankan:

    npm run dev

### Deployment di Vercel

Karena ini adalah aplikasi statis, deployment di Vercel sangat mudah:

1.  Hubungkan repositori Git Anda ke Vercel.
2.  Vercel akan secara otomatis mendeteksi konfigurasi build React/Vite
    (`npm run build`).
3.  Vercel menyajikan output dari direktori `dist` ke CDN globalnya.
