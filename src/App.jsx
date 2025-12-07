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

    const sourceRatio = sourceImage.width / sourceImage.height;
    const targetRatio = targetW / targetH;

    let renderW, renderH, offsetX, offsetY;

    if (sourceRatio > targetRatio) {
      renderH = targetH;
      renderW = sourceImage.width * (targetH / sourceImage.height);
      offsetX = (targetW - renderW) / 2;
      offsetY = 0;
    } else {
      renderW = targetW;
      renderH = sourceImage.height * (targetW / sourceImage.width);
      offsetX = 0;
      offsetY = (targetH - renderH) / 2;
    }

    ctx.drawImage(sourceImage, offsetX, offsetY, renderW, renderH);

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
    if (!sourceImage || !window.JSZip) return;
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

        // 2. Tambahkan File yang Diubah Ukurannya (8 file)
        for (const size of TARGET_SIZES) {
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
    <div className="min-h-screen bg-[#f3f4f6] font-sans text-slate-900 p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 tracking-tight">
          Print<span className="text-blue-600">Resizer</span>
        </h1>
        <p className="text-gray-500 text-sm md:text-base">
          Unggah satu gambar. Kami otomatis mendeteksi orientasi dan menskalakannya ke ukuran cetak standar (300 DPI).
        </p>
      </div>

      <div className="space-y-8">
        {!sourceImage ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
                border-4 border-dashed rounded-2xl p-12 text-center transition-all duration-300
                flex flex-col items-center justify-center cursor-pointer min-h-[300px]
                ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50 bg-white'}
            `}
          >
            <div className="bg-blue-100 p-4 rounded-full mb-4 text-blue-600">
              <Upload size={48} />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">Seret & Lepas foto Anda di sini</h3>
            <p className="text-gray-400 mb-6">atau klik di bawah untuk menelusuri</p>
            <label className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-colors cursor-pointer">
              Unggah Gambar
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
            <p className="mt-4 text-xs text-gray-400">Mendukung JPG, PNG, WEBP</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Control Bar & Title Input */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
                {/* Image Info and Controls */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="h-12 w-12 bg-white rounded border border-gray-200 overflow-hidden shrink-0">
                        <img src={sourceImage.src} className="w-full h-full object-cover" alt="Original thumbnail" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-800 text-sm">Asli</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isLandscape ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isLandscape ? 'Lanskap' : 'Potret'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {sourceDimensions.w} x {sourceDimensions.h} px
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {zipLibLoaded && (
                            <button 
                                onClick={downloadAllZip}
                                disabled={isZipping || !fileNamePrefix.trim()}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isZipping ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                                {isZipping ? 'Membuat Zip (9 File)...' : 'Unduh Semua (9 File ZIP)'}
                            </button>
                      )}

                      <button
                            onClick={clearImage}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                      >
                            <Trash2 size={16} />
                            <span className="md:hidden">Hapus</span>
                      </button>
                    </div>
                </div>

                {/* File Title Input */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                    <label htmlFor="file-title" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
                        <Tag size={16} className="text-blue-600"/> Judul File Ekspor
                    </label>
                    <input
                        id="file-title"
                        type="text"
                        value={fileNamePrefix}
                        onChange={(e) => setFileNamePrefix(e.target.value)}
                        placeholder="Cth: FotoPemandangan"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                        maxLength={50}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Nama file yang diubah ukurannya akan menjadi: 
                        <span className="font-mono text-gray-600"> {fileNamePrefix || '[Judul]'} _ [Ukuran].jpg (Cth: 9x12in atau A2)</span>
                        <br/>
                        File asli akan dinamai: 
                        <span className="font-mono text-gray-600"> {fileNamePrefix || '[Judul]'} _ original.jpg (Mengandung metadata 300 DPI)</span>
                    </p>
                </div>

            </div>

            {/* Results Grid */}
            <div className="p-6 md:p-8 bg-gray-50/50">
              <div className="flex items-center gap-2 mb-6 text-gray-700">
                <FileImage size={20} className="text-blue-600" />
                <h2 className="font-bold text-lg">Pratinjau & Unduh</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {TARGET_SIZES.map((size) => {
                  const { wPx, hPx, label } = getTargetDimensions(size);
                  // Tentukan rasio aspek tampilan untuk kartu pratinjau
                  const cardIsPortrait = hPx > wPx;
                  
                  return (
                    <div
                      key={size.id}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                    >
                      {/* Visual Preview */}
                      <div className="relative w-full bg-gray-100 border-b border-gray-100 aspect-square group p-4">
                        <div
                          className="w-full h-full shadow-lg bg-white overflow-hidden flex items-center justify-center mx-auto"
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
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 flex flex-col gap-3 flex-grow justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-gray-900">{label}</h3>
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full">
                              300 DPI
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {wPx} x {hPx} px
                          </p>
                        </div>

                        <button
                          onClick={() => downloadSingle(size)}
                          disabled={generatingId === size.id || isZipping || !fileNamePrefix.trim()}
                          className={`
                              w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all
                              ${
                                generatingId === size.id
                                  ? 'bg-gray-100 text-gray-400 cursor-wait'
                                  : 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg active:scale-95'
                              }
                              ${!fileNamePrefix.trim() ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          {generatingId === size.id ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Memproses...
                            </>
                          ) : (
                            <>
                              <Download size={16} />
                              Unduh .JPG
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex items-start gap-3 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p>
                  <strong>Catatan Penting:</strong> Semua hasil ekspor, termasuk file asli yang disalin, adalah file JPEG 300 DPI dengan format nama file kustom Anda.
                  <br/>
                  Pastikan kolom **Judul File Ekspor** terisi sebelum mengunduh.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 text-center text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} ImUpscaller. Berjalan secara lokal di browser Anda.</p>
      </div>
    </div>
  );
}