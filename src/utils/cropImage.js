// Convert hasil crop (pixel) menjadi Base64 data URL via canvas
export function getCroppedImg(imageSrc, cropPixels) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropPixels.width;
      canvas.height = cropPixels.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        image,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        cropPixels.width,
        cropPixels.height
      );
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    image.onerror = (e) => reject(e);
    image.src = imageSrc;
  });
}
