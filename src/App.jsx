import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, AlertCircle, FileImage, Loader2, Package, Tag } from 'lucide-react';

// Konfigurasi untuk ukuran yang diperlukan (Definisi Potret Dasar)
const TARGET_SIZES = [
  { id: '5x7', label: '5 x 7 in', width: 5, height: 7, unit: 'in' },
  { id: '8x10', label: '8 x 10 in', width: 8, height: 10, unit: 'in' },
  { id: '9x12', label: '9 x 12 in', width: 9, height: 12, unit: 'in' },
  { id: '11x14', label: '11 x 14 in', width: 11, height: 14, unit: 'in' },
  { id: '16x20', label: '16 x 20 in', width: 16, height: 20, unit: 'in' },
  { id: '18x24', label: '18 x 24 in', width: 18, height: 24, unit: 'in' },
  { id: '24x36', label: '24 x 36 in', width: 24, height: 36, unit: 'in' },
  { id: 'A2', label: 'A2 (420 x 594 mm)', width: 420, height: 594, unit: 'mm' },
];

const DPI = 300; // DPI wajib untuk resolusi cetak

const checkerboardStyle = {
  backgroundColor: '#ffffff',
  backgroundImage: `
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%), 
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%), 
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
  `,
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
};

/**
 * Injeksi metadata JFIF APP0 ke dalam Blob JPEG untuk mengatur DPI file.
 * Ini memastikan perangkat lunak eksternal membaca gambar sebagai 300 DPI.
 * @param {Blob} jpegBlob Blob gambar JPEG asli dari canvas.toBlob().
 * @param {number} density Nilai DPI (misalnya, 300).
 * @returns {Promise<Blob>} Promise yang menghasilkan Blob JPEG baru yang berisi metadata DPI.
 */
const injectDpiMetadata = (jpegBlob, density) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const buffer = e.target.result;
            const dataView = new DataView(buffer);
            
            // Periksa penanda SOI (Start of Image): 0xFFD8
            if (dataView.getUint16(0) !== 0xFFD8) {
                console.error("Bukan file JPEG yang valid untuk injeksi DPI.");
                return resolve(jpegBlob);
            }

            // --- Buat segmen penanda JFIF APP0 (total 18 byte) ---
            const jfifMarker = new ArrayBuffer(18);
            const jfifView = new DataView(jfifMarker);
            
            let offset = 0;
            jfifView.setUint16(offset, 0xFFE0); // Penanda APP0
            offset += 2;
            jfifView.setUint16(offset, 16);    // Panjang sisa segmen (16 byte)
            offset += 2;
            
            // Pengenal JFIF 'JFIF\x00'
            const jfifId = 'JFIF\x00';
            for (let i = 0; i < jfifId.length; i++) {
                jfifView.setUint8(offset + i, jfifId.charCodeAt(i));
            }
            offset += 5;
            
            jfifView.setUint16(offset, 0x0102); // Versi JFIF 1.02
            offset += 2;
            jfifView.setUint8(offset, 0x01);    // Satuan Kepadatan: 1 = titik/inci (DPI)
            offset += 1;
            
            // Kepadatan (300 DPI dalam 2 byte, Big Endian)
            jfifView.setUint16(offset, density); // Kepadatan X
            offset += 2;
            jfifView.setUint16(offset, density); // Kepadatan Y
            offset += 2;
            
            jfifView.setUint8(offset, 0);       // Gambar Miniatur X (tanpa gambar mini)
            offset += 1;
            jfifView.setUint8(offset, 0);       // Gambar Miniatur Y (tanpa gambar mini)
            
            // --- Gabungkan segmen: SOI (2) + APP0 (18) + Sisa File ---
            const newBuffer = new ArrayBuffer(buffer.byteLength + 18);
            const newArray = new Uint8Array(newBuffer);
            const oldArray = new Uint8Array(buffer);
            const jfifArray = new Uint8Array(jfifMarker);

            // 1. Salin SOI (0xFFD8) dari file lama ke awal file baru (2 byte)
            newArray.set(oldArray.slice(0, 2), 0);
            
            // 2. Sisipkan penanda JFIF APP0 (18 byte)
            newArray.set(jfifArray, 2);
            
            // 3. Salin sisa file asli (semua setelah SOI)
            newArray.set(oldArray.slice(2), 20); // mulai salin di indeks 20
            
            // Selesaikan dengan Blob baru
            resolve(new Blob([newBuffer], { type: 'image/jpeg' }));
        };
        reader.readAsArrayBuffer(jpegBlob);
    });
};


export default function App() {
  const [sourceImage, setSourceImage] = useState(null);
  const [sourceDimensions, setSourceDimensions] = useState({ w: 0, h: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipLibLoaded, setZipLibLoaded] = useState(false);
  const [fileNamePrefix, setFileNamePrefix] = useState('FotoSaya'); // Judul file kustom
  const [selectedSizes, setSelectedSizes] = useState(TARGET_SIZES.map(s => s.id)); // All selected by default

  // Muat JSZip secara dinamis
  useEffect(() => {
    if (!window.JSZip) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.async = true;
      script.onload = () => setZipLibLoaded(true);
      document.body.appendChild(script);
    } else {
      setZipLibLoaded(true);
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const processFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setSourceDimensions({ w: img.width, h: img.height });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const clearImage = () => {
    setSourceImage(null);
    setSourceDimensions({ w: 0, h: 0 });
    setFileNamePrefix('FotoSaya');
    setSelectedSizes(TARGET_SIZES.map(s => s.id)); // Reset to all selected
  };

  const toggleSize = (sizeId) => {
    setSelectedSizes(prev => 
      prev.includes(sizeId) 
        ? prev.filter(id => id !== sizeId)
        : [...prev, sizeId]
    );
  };

  const toggleAllSizes = () => {
    setSelectedSizes(prev => 
      prev.length === TARGET_SIZES.length 
        ? [] 
        : TARGET_SIZES.map(s => s.id)
    );
  };

  // Deteksi orientasi
  const isLandscape = sourceDimensions.w > sourceDimensions.h;

  // Hitung dimensi, tukar l/t jika gambar adalah lanskap
  const getTargetDimensions = (size) => {
    let targetW = size.width;
    let targetH = size.height;

    // Jika sumber adalah lanskap, kami membalik batasan target agar sesuai
    if (isLandscape) {
       targetW = size.height;
       targetH = size.width;
    }

    let wPx, hPx;
    // Hitung ulang dimensi piksel berdasarkan kemungkinan L/T yang ditukar
    if (size.unit === 'in') {
      wPx = Math.round(targetW * DPI);
      hPx = Math.round(targetH * DPI);
    } else {
      // 1 inci = 25.4 mm
      wPx = Math.round((targetW / 25.4) * DPI);
      hPx = Math.round((targetH / 25.4) * DPI);
    }

    // Tentukan label yang menghadap pengguna untuk ukuran yang disesuaikan
    let displayLabel = size.label;
    if (isLandscape && size.unit !== 'mm') {
        displayLabel = `${size.height} x ${size.width} ${size.unit}`;
    } else if (isLandscape && size.unit === 'mm') {
         displayLabel = `A2 (${size.height} x ${size.width} ${size.unit})`;
    }


    return { 
        wPx, 
        hPx, 
        label: displayLabel
    };
  };
  
  // Logika pembuatan Blob untuk gambar ASLI (menggunakan dimensi asli)
  const generateOriginalImageBlob = async () => {
    if (!sourceImage) throw new Error("Gambar sumber tidak dimuat.");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Gunakan dimensi asli
    canvas.width = sourceDimensions.w;
    canvas.height = sourceDimensions.h;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Gambar gambar asli ke kanvas
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
        canvas.toBlob(async (originalBlob) => {
            if (!originalBlob) {
                console.error("Gagal membuat blob asli untuk ZIP.");
                return resolve(null);
            }
            
            // Suntikkan metadata DPI untuk konsistensi
            const dpiBlob = await injectDpiMetadata(originalBlob, DPI);
            
            // Sanitasi prefix judul file
            const safePrefix = fileNamePrefix.trim().replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, ''); 
            
            // PERUBAHAN: Hapus dimensi dari nama file asli
            // Format nama file: [judul]_original.jpg
            const newFilename = `${safePrefix || 'Foto'}_original.jpg`; 

            resolve({
                blob: dpiBlob,
                filename: newFilename
            });
        }, 'image/jpeg', 0.95); // Memastikan output adalah JPEG
    });
  };

  // Logika pembuatan yang dapat digunakan kembali yang mengembalikan Blob (untuk ukuran cetak)
  const generateImageBlob = async (size) => {
    if (!sourceImage) throw new Error("Gambar sumber tidak dimuat.");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const { wPx: targetW, hPx: targetH } = getTargetDimensions(size);
    
    canvas.width = targetW;
    canvas.height = targetH;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // STRETCH MODE: Gambar langsung di-stretch untuk mengisi canvas
    // Tidak ada cropping, aspect ratio bisa berubah
    ctx.drawImage(sourceImage, 0, 0, targetW, targetH);

    return new Promise((resolve) => {
        canvas.toBlob(async (originalBlob) => {
            if (!originalBlob) {
                console.error("Gagal membuat blob asli.");
                return resolve(null);
            }
            
            // 1. Suntikkan metadata DPI ke dalam blob JPEG
            const dpiBlob = await injectDpiMetadata(originalBlob, DPI);
            
            // --- MULAI PERUBAHAN FILENAME ---
            // Dapatkan dimensi cetak (yang mungkin telah dibalik jika gambar adalah lanskap)
            let printW = size.width;
            let printH = size.height;

            // Jika sumber adalah lanskap, kami membalik dimensi cetak untuk penamaan.
            if (isLandscape) {
                printW = size.height;
                printH = size.width;
            }

            // PERUBAHAN: Gunakan "A2" untuk ukuran file A2
            let sizeString;
            if (size.id === 'A2') {
                sizeString = 'A2'; 
            } else {
                // Buat string ukuran bersih: [W]x[H][unit] (e.g., 5x7in, 420x594mm)
                sizeString = `${printW}x${printH}${size.unit}`;
            }
            
            // Sanitasi prefix judul file: ganti spasi dengan _ dan hapus karakter non-alfanumerik lain
            const safePrefix = fileNamePrefix.trim().replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, ''); 
            
            // Format nama file baru: [judul]_[ukuran_cetak].jpg
            const newFilename = `${safePrefix || 'Foto'}_${sizeString}.jpg`;
            // --- AKHIR PERUBAHAN FILENAME ---

            resolve({
                blob: dpiBlob,
                filename: newFilename
            });
        }, 'image/jpeg', 0.95); // Memastikan output adalah JPEG
    });
  };

  const downloadSingle = async (size) => {
    if (!sourceImage) return;
    setGeneratingId(size.id);

    // Beri jeda ke UI untuk menampilkan pemintal
    try {
        const result = await generateImageBlob(size);
        if (result) {
            const { blob, filename } = result;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error("Unduhan gagal:", error);
    } finally {
        setGeneratingId(null);
    }
  };

  const downloadAllZip = async () => {
    if (!sourceImage || !window.JSZip || selectedSizes.length === 0) return;
    setIsZipping(true);

    // Sanitasi prefix judul file untuk nama folder
    const safePrefix = fileNamePrefix.trim().replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, ''); 
    const folderName = `upscaled-${safePrefix || 'Foto'}`;

    const zip = new window.JSZip();
    const folder = zip.folder(folderName);

    try {
        // 1. TAMBAH FILE ASLI KE ZIP
        const originalResult = await generateOriginalImageBlob();
        if (originalResult && originalResult.blob) {
            folder.file(originalResult.filename, originalResult.blob);
        }

        // 2. Tambahkan File yang Dipilih Saja
        const selectedSizeObjects = TARGET_SIZES.filter(size => selectedSizes.includes(size.id));
        for (const size of selectedSizeObjects) {
            const result = await generateImageBlob(size);
            if (result && result.blob) {
                folder.file(result.filename, result.blob);
            }
        }
    
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.download = `${folderName}.zip`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Unduhan batch gagal:", error);
    } finally {
        setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans text-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-4 md:px-8 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-3">
            Im<span className="text-emerald-600">UpScaller</span>
          </h1>
          <p className="text-slate-600 text-base md:text-lg font-medium">
            Cetak berkualitas studio dari foto apa pun
          </p>
          
          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">300 DPI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">100% Privat</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Instan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-8 py-12">
        <div className={`mx-auto ${!sourceImage ? 'max-w-4xl' : 'max-w-[1600px]'}`}>
        {!sourceImage ? (
          <div className="space-y-8">
            {/* Upload Card */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                bg-white rounded-2xl p-16 text-center transition-all duration-300 cursor-pointer
                border border-slate-200/60
                ${isDragging 
                  ? 'shadow-2xl shadow-emerald-500/20 scale-[1.02] border-emerald-400 ring-4 ring-emerald-100' 
                  : 'shadow-lg hover:shadow-xl hover:-translate-y-1'
                }
              `}
            >
              {/* Icon */}
              <div className="mb-6 flex justify-center">
                <div className={`relative transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl blur-xl opacity-20"></div>
                  <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-2xl">
                    <FileImage size={40} className="text-white" strokeWidth={2} />
                  </div>
                </div>
              </div>

              {/* Headline */}
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                {isDragging ? 'Lepas untuk mulai cetak' : 'Siapkan foto Anda untuk dicetak'}
              </h2>
              
              {/* Subtext */}
              <p className="text-slate-600 mb-10 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                Deteksi orientasi otomatis • Ekspor 8 ukuran cetak standar
              </p>

              {/* Button */}
              <label className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold py-4 px-10 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer active:scale-95 text-base tracking-wide">
                <Upload size={20} strokeWidth={2.5} />
                Pilih Foto
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>

              {/* Supported Formats */}
              <p className="mt-6 text-xs text-slate-500 font-medium">
                JPG, PNG, atau WEBP
              </p>

              {/* Privacy Note */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Diproses di browser Anda • Tidak ada upload ke server
                </p>
              </div>
            </div>

            {/* How It Works */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-slate-200/40">
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Upload size={24} className="text-white" strokeWidth={2.5} />
                </div>
                <p className="text-base font-semibold text-slate-700">Upload foto apa pun</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-slate-200/40">
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-slate-700">Deteksi orientasi otomatis</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-slate-200/40">
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <Package size={24} className="text-white" strokeWidth={2.5} />
                </div>
                <p className="text-base font-semibold text-slate-700">Download 8 ukuran cetak</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
            {/* Control Bar & Title Input */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                {/* Image Info and Controls */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="h-16 w-16 bg-white rounded-xl border-2 border-slate-200 overflow-hidden shrink-0 shadow-sm">
                        <img src={sourceImage.src} className="w-full h-full object-cover" alt="Original thumbnail" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-slate-900 text-base">Foto Asli</p>
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${isLandscape ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isLandscape ? 'Lanskap' : 'Potret'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium">
                          {sourceDimensions.w} × {sourceDimensions.h} px
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {zipLibLoaded && (
                            <button 
                                onClick={downloadAllZip}
                                disabled={isZipping || !fileNamePrefix.trim() || selectedSizes.length === 0}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                            >
                                {isZipping ? <Loader2 size={18} className="animate-spin" strokeWidth={2.5} /> : <Package size={18} strokeWidth={2.5} />}
                                {isZipping ? 'Membuat ZIP...' : `Download Terpilih (${selectedSizes.length})`}
                            </button>
                      )}

                      <button
                            onClick={clearImage}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 border-2 border-red-200 hover:border-red-300 px-5 py-3 rounded-xl transition-all text-sm font-bold active:scale-95"
                      >
                            <Trash2 size={18} strokeWidth={2.5} />
                            <span>Hapus</span>
                      </button>
                    </div>
                </div>

                {/* File Title Input */}
                <div className="bg-white rounded-xl p-5 border border-slate-200">
                    <label htmlFor="file-title" className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-2">
                        <Tag size={16} className="text-emerald-600" strokeWidth={2.5} /> 
                        Nama File Output
                    </label>
                    <input
                        id="file-title"
                        type="text"
                        value={fileNamePrefix}
                        onChange={(e) => setFileNamePrefix(e.target.value)}
                        placeholder="Contoh: FotoPemandangan"
                        className="w-full p-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium transition-all"
                        maxLength={50}
                    />
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                        Format: <span className="font-mono text-slate-700 font-semibold">{fileNamePrefix || '[Nama]'}_5x7in.jpg</span>, 
                        <span className="font-mono text-slate-700 font-semibold"> {fileNamePrefix || '[Nama]'}_A2.jpg</span>, dll
                    </p>
                </div>

            </div>

            {/* Results Grid */}
            <div className="p-8 bg-gradient-to-br from-slate-50 to-white">
              {/* Header with Select All Toggle */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <FileImage size={20} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-xl text-slate-900">Pilih Ukuran Cetak</h2>
                      <span className="bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
                        300 DPI
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {selectedSizes.length} dari {TARGET_SIZES.length} ukuran dipilih
                    </p>
                  </div>
                </div>
                
                {/* Select All/None Toggle */}
                <button
                  onClick={toggleAllSizes}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-300 active:scale-95"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selectedSizes.length === TARGET_SIZES.length 
                      ? 'bg-emerald-600 border-emerald-600' 
                      : selectedSizes.length > 0 
                        ? 'bg-emerald-200 border-emerald-400' 
                        : 'border-slate-300 bg-white'
                  }`}>
                    {selectedSizes.length > 0 && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-slate-700">
                    {selectedSizes.length === TARGET_SIZES.length ? 'Hapus Semua' : 'Pilih Semua'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-6">
                {TARGET_SIZES.map((size) => {
                  const { wPx, hPx, label } = getTargetDimensions(size);
                  const cardIsPortrait = hPx > wPx;
                  
                  const isSelected = selectedSizes.includes(size.id);
                  
                  return (
                    <div
                      key={size.id}
                      onClick={() => toggleSize(size.id)}
                      className={`bg-white rounded-xl border-2 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group hover:-translate-y-1 cursor-pointer ${
                        isSelected 
                          ? 'border-emerald-500 ring-2 ring-emerald-200' 
                          : 'border-slate-200 hover:border-emerald-400'
                      }`}
                    >
                      {/* Visual Preview */}
                      <div className="relative w-full bg-gradient-to-br from-slate-100 to-slate-50 border-b-2 border-slate-200 aspect-square p-4">
                        {/* Checkbox Overlay */}
                        <div className="absolute top-3 left-3 z-10">
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shadow-md ${
                            isSelected 
                              ? 'bg-emerald-600 border-emerald-600' 
                              : 'bg-white border-slate-300 group-hover:border-emerald-400'
                          }`}>
                            {isSelected && (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                        
                        <div
                          className="w-full h-full shadow-lg bg-white overflow-hidden flex items-center justify-center mx-auto rounded-lg"
                          style={checkerboardStyle}
                        >
                          <div
                            style={{
                              aspectRatio: `${wPx}/${hPx}`,
                              width: cardIsPortrait ? 'auto' : '100%',
                              height: cardIsPortrait ? '100%' : 'auto',
                            }}
                            className="relative max-w-full max-h-full"
                          >
                            <img
                              src={sourceImage.src}
                              alt={label}
                              className="w-full h-full object-fill"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-5 flex flex-col gap-4 flex-grow justify-between bg-white">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-slate-900 text-base">{label}</h3>
                          </div>
                          <p className="text-xs text-slate-500 font-semibold">
                            {wPx} × {hPx} px
                          </p>
                        </div>

                        {/* Individual Download Button (Keep for single downloads) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card toggle
                            downloadSingle(size);
                          }}
                          disabled={generatingId === size.id || isZipping || !fileNamePrefix.trim()}
                          className={`
                              w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all duration-200
                              ${
                                generatingId === size.id
                                  ? 'bg-slate-100 text-slate-400 cursor-wait'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 active:scale-95'
                              }
                              ${!fileNamePrefix.trim() ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          {generatingId === size.id ? (
                            <>
                                <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
                                Memproses...
                            </>
                          ) : (
                            <>
                              <Download size={16} strokeWidth={2.5} />
                              Download
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 flex items-start gap-4 p-6 bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-xl text-sm">
                <AlertCircle size={22} className="shrink-0 mt-0.5 text-blue-600" strokeWidth={2.5} />
                <div className="space-y-1">
                  <p className="font-bold">Catatan Penting</p>
                  <p className="text-blue-800 leading-relaxed">
                    Semua file output adalah JPEG 300 DPI siap cetak. Pastikan <strong>Nama File Output</strong> sudah diisi sebelum download.
                  </p>
                </div>
              </div>
            </div>
          </div>
          </div>
        )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200/60 bg-white/80 backdrop-blur-sm px-4 py-6">
        <div className="max-w-4xl mx-auto text-center text-slate-500 text-xs font-medium">
          <p>© 2025 ImUpScaller</p>
        </div>
      </div>
    </div>
  );
}