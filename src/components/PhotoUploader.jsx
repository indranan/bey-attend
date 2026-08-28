import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import toast from 'react-hot-toast';
import { getCroppedImg } from '../utils/cropImage';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const PhotoUploader = ({ onCropped, isSubmitting }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);
  const fileRef = useRef(null);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.error('Ukuran maksimal foto 10MB!');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onCropComplete = (_, areaPixels) => setCropPixels(areaPixels);

  const handleSave = async () => {
    if (!imageSrc || !cropPixels) return;
    try {
      const base64 = await getCroppedImg(imageSrc, cropPixels);
      setImageSrc(null);
      setCropPixels(null);
      onCropped(base64);
    } catch {
      toast.error('Gagal memproses foto');
    }
  };

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isSubmitting}
        className="text-[10px] font-black text-primary border-2 border-primary/20 px-6 py-2 rounded-full flex items-center gap-2 mx-auto hover:bg-primary/5 transition-all disabled:opacity-50"
      >
        GANTI FOTO
      </button>

      {imageSrc &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm max-h-[90vh] bg-white dark:bg-dark-card rounded-[2rem] overflow-hidden shadow-2xl">

              <div className="relative h-72 bg-black">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="p-4 space-y-4">
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-primary"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImageSrc(null);
                      setCropPixels(null);
                    }}
                    className="flex-1 py-3 rounded-2xl bg-gray-200 dark:bg-gray-700 font-black text-xs"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-2xl bg-primary dark:text-white font-black text-xs disabled:opacity-50"
                  >
                    {isSubmitting ? 'Mengunggah...' : 'Simpan Foto'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default PhotoUploader;
