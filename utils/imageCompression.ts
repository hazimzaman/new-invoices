import imageCompression from 'browser-image-compression';

export const compressImage = async (base64String: string): Promise<string> => {
  // Convert base64 to blob
  const response = await fetch(base64String);
  const blob = await response.blob();

  // Compress the image
  const compressedFile = await imageCompression(new File([blob], "image.jpg", {
    type: blob.type
  }), {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true
  });

  // Convert back to base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressedFile);
  });
}; 