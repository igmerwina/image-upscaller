import React, { useState, useEffect } from 'react';
import { Upload, Download, Loader2, Package, Check } from 'lucide-react';

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

  const allSelected = selectedSizes.length === TARGET_SIZES.length;
  const nameMissing = !fileNamePrefix.trim();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 md:px-8 py-4 flex items-center justify-between gap-4 border-b border-rule font-mono text-[11px] text-muted">
        <span className="text-ink">ImUpScaller</span>
        <span className="hidden sm:inline">Cetak 300 DPI, diproses di browser</span>
        <span className="bg-prussian text-sheet px-2 py-0.5">Tanpa upload</span>
      </header>

      <main className="flex-1 px-4 md:px-8 py-10 md:py-14">
        {!sourceImage ? (
          <div className="max-w-6xl mx-auto grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center">
            <div>
              <h1 className="font-serif text-[3.25rem] md:text-[4.75rem] leading-[0.95] tracking-[-0.01em]">
                Siap cetak,
                <span className="block italic text-prussian">sampai A2.</span>
              </h1>
              <p className="mt-6 max-w-[38ch] text-[15px] leading-relaxed text-muted">
                Taruh satu foto. Kami buat file JPEG 300 DPI untuk delapan ukuran cetak standar,
                orientasinya mengikuti foto Anda.
              </p>
              <ul className="mt-8 flex flex-wrap gap-2">
                {TARGET_SIZES.map((s) => (
                  <li key={s.id} className="rounded-full border border-rule bg-sheet/60 px-3 py-1 text-xs text-muted">
                    {s.id === 'A2' ? 'A2' : `${s.width}×${s.height}`}
                  </li>
                ))}
              </ul>
            </div>

            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="sheet relative block cursor-pointer p-5 md:p-7 rotate-[0.6deg] transition-transform duration-300 hover:rotate-0 focus-within:rotate-0"
            >
              <input type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
              <div
                className={`h-[min(62vh,560px)] min-h-[320px] border border-dashed flex flex-col items-center justify-center text-center px-6 transition-colors duration-200 ${
                  isDragging ? 'border-prussian bg-prussian/10' : 'border-ink/25 bg-paper/40'
                }`}
              >
                <p className="font-serif text-3xl md:text-4xl leading-tight">
                  {isDragging ? 'Lepaskan di sini' : 'Taruh foto di kertas ini'}
                </p>
                <p className="mt-3 text-sm text-muted">JPG, PNG, atau WEBP</p>
              </div>
              <span className="absolute -bottom-7 -left-4 md:-left-8 grid place-items-center w-24 h-24 rounded-full bg-sun text-ink text-sm font-semibold shadow-[0_10px_24px_-10px_rgba(30,29,26,.6)]">
                <span className="flex flex-col items-center gap-1">
                  <Upload size={18} strokeWidth={2} />
                  Pilih foto
                </span>
              </span>
            </label>
          </div>
        ) : (
          <div className="max-w-[1400px] mx-auto grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            <aside className="lg:sticky lg:top-8 space-y-6">
              <div className="sheet p-4">
                <img src={sourceImage.src} className="w-full max-h-[50vh] object-contain bg-paper/40" alt="Foto asli" />
                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span className="font-serif text-xl">Foto asli</span>
                  <span className="text-muted">
                    {sourceDimensions.w}×{sourceDimensions.h} px, {isLandscape ? 'lanskap' : 'potret'}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="file-title" className="block text-sm font-medium mb-2">Nama file</label>
                <input
                  id="file-title"
                  type="text"
                  value={fileNamePrefix}
                  onChange={(e) => setFileNamePrefix(e.target.value)}
                  placeholder="FotoPemandangan"
                  maxLength={50}
                  className="w-full bg-sheet border border-rule px-3 py-2.5 text-sm focus:border-prussian focus:outline-none"
                />
                <p className="mt-2 text-xs text-muted break-all">
                  {nameMissing ? 'Isi nama file sebelum mengunduh.' : `Contoh: ${fileNamePrefix.trim()}_A2.jpg`}
                </p>
              </div>

              <div className="space-y-2">
                {zipLibLoaded && (
                  <button
                    onClick={downloadAllZip}
                    disabled={isZipping || nameMissing || selectedSizes.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-prussian hover:bg-prussian-dark text-sheet px-5 py-3 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isZipping ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                    {isZipping ? 'Membuat ZIP…' : `Unduh ZIP (${selectedSizes.length} ukuran + asli)`}
                  </button>
                )}
                <button
                  onClick={clearImage}
                  className="w-full px-5 py-3 text-sm text-muted hover:text-ink border border-rule hover:border-ink/40 transition-colors"
                >
                  Ganti foto
                </button>
              </div>
            </aside>

            <section>
              <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div>
                  <h2 className="font-serif text-4xl md:text-5xl leading-none">Ukuran cetak</h2>
                  <p className="mt-2 text-sm text-muted">
                    {selectedSizes.length} dari {TARGET_SIZES.length} dipilih untuk ZIP. Semua JPEG 300 DPI.
                  </p>
                </div>
                <button
                  onClick={toggleAllSizes}
                  className="text-sm underline underline-offset-4 decoration-rule hover:decoration-ink"
                >
                  {allSelected ? 'Kosongkan pilihan' : 'Pilih semua'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
                {TARGET_SIZES.map((size) => {
                  const { wPx, hPx, label } = getTargetDimensions(size);
                  const isSelected = selectedSizes.includes(size.id);
                  const busy = generatingId === size.id;

                  return (
                    <div key={size.id}>
                      <button
                        onClick={() => toggleSize(size.id)}
                        aria-pressed={isSelected}
                        className="group block w-full text-left"
                      >
                        <div className={`relative grid place-items-center ${isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]'}`}>
                          <div
                            style={{ aspectRatio: `${wPx}/${hPx}` }}
                            className={`sheet p-[6%] transition-all duration-200 ${
                              hPx > wPx ? 'h-full' : 'w-full'
                            } ${isSelected ? 'outline outline-2 outline-offset-4 outline-prussian' : 'opacity-60 group-hover:opacity-100'}`}
                          >
                            <img src={sourceImage.src} alt="" className="w-full h-full object-fill" />
                          </div>
                          {isSelected && (
                            <span className="absolute top-0 right-0 grid place-items-center w-6 h-6 rounded-full bg-prussian text-sheet">
                              <Check size={14} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <p className="mt-4 font-serif text-xl leading-tight">{label}</p>
                        <p className="text-xs text-muted">{wPx}×{hPx} px</p>
                      </button>
                      <button
                        onClick={() => downloadSingle(size)}
                        disabled={busy || isZipping || nameMissing}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-prussian hover:underline underline-offset-4 disabled:text-muted disabled:no-underline disabled:cursor-not-allowed"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        {busy ? 'Memproses…' : 'Unduh ukuran ini'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="px-4 md:px-8 py-5 border-t border-rule text-xs text-muted">
        © 2025 ImUpScaller. File tidak pernah meninggalkan perangkat Anda.
      </footer>
    </div>
  );
}
