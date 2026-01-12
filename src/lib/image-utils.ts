/**
 * Converts a File/Blob to a WebP data URL or Blob.
 */
export async function convertToWebP(file: File | Blob, quality: number = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Optional: Resize if too large
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas toBlob failed'));
                        }
                    },
                    'image/webp',
                    quality
                );
            };
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(file);
    });
}

export function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
