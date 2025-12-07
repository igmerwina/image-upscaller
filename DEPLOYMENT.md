# Panduan Deployment ke Vercel

Proyek PrintResizer sekarang telah dikonfigurasi untuk deployment di Vercel. Ikuti langkah-langkah di bawah ini.

## Prasyarat

- Akun GitHub dengan repositori proyek ini
- Akun Vercel (https://vercel.com)
- Node.js dan npm terinstall di komputer lokal

## Langkah-langkah Deployment

### 1. Setup Lokal

Instal dependencies terlebih dahulu:

```bash
npm install
```

### 2. Test Build Lokal

Sebelum deployment, pastikan build bekerja dengan baik:

```bash
npm run build
```

Periksa folder `dist` untuk memastikan files ter-generate dengan baik.

### 3. Push ke GitHub

Jika belum, commit dan push perubahan ke repository GitHub:

```bash
git add .
git commit -m "Configure project for Vercel deployment"
git push origin main
```

### 4. Deployment ke Vercel

**Opsi A: Menggunakan Vercel Dashboard**

1. Buka https://vercel.com/dashboard
2. Klik "Add New" → "Project"
3. Pilih repository GitHub Anda (Upscaller)
4. Vercel akan secara otomatis mendeteksi:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Klik "Deploy"

**Opsi B: Menggunakan Vercel CLI**

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login ke Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

## File Konfigurasi yang Dibuat

### `vercel.json`
Konfigurasi Vercel untuk project Vite React.

### `vite.config.js`
Konfigurasi Vite dengan optimisasi untuk production:
- Output directory: `dist`
- Sourcemap disabled untuk production
- Minification: enabled

### `package.json`
Berisi:
- Script `build` untuk production build
- Dependencies: React, React-DOM, lucide-react
- DevDependencies: Vite, Tailwind CSS, PostCSS

### `tailwind.config.js` & `postcss.config.js`
Konfigurasi Tailwind CSS untuk styling.

### `index.html`
Entry point HTML yang mereferensikan `src/main.jsx`.

### `src/main.jsx`
React entry point yang merender komponen App ke DOM.

### `.gitignore`
Mengabaikan folder `node_modules`, `dist`, dan file-file yang tidak perlu di-commit.

## Struktur Folder

```
Upscaller/
├── src/
│   ├── App.jsx           # Main application component
│   ├── main.jsx          # React entry point
│   └── index.css         # Global styles
├── index.html            # HTML entry point
├── package.json          # Dependencies dan scripts
├── vite.config.js        # Vite configuration
├── vercel.json           # Vercel configuration
├── tailwind.config.js    # Tailwind configuration
├── postcss.config.js     # PostCSS configuration
└── README.md             # Project documentation
```

## Troubleshooting

### Build Error
Jika ada error saat build:
```bash
npm install --legacy-peer-deps
npm run build
```

### Port Already in Use
Jika port 3000 sudah digunakan:
```bash
npm run dev -- --port 3001
```

### Vercel Build Failed
1. Cek logs di Vercel Dashboard
2. Pastikan `node_modules` tidak di-commit
3. Verifikasi `vercel.json` sudah benar

## Environment Variables (Opsional)

Jika Anda perlu environment variables di Vercel:

1. Buka project di Vercel Dashboard
2. Pergi ke "Settings" → "Environment Variables"
3. Tambahkan variable sesuai kebutuhan
4. Redeploy

## Support

Untuk informasi lebih lanjut tentang Vite: https://vitejs.dev/
Untuk informasi lebih lanjut tentang Vercel: https://vercel.com/docs
