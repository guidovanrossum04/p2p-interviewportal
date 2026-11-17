export function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (progress: number) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener('load', () => {
      if (!request.status) {
        reject(new Error('Video upload failed. Check your connection and try again.'));
        return;
      }
      resolve(new Response(request.responseText, {
        status: request.status,
        statusText: request.statusText,
        headers: { 'Content-Type': request.getResponseHeader('Content-Type') || 'application/json' },
      }));
    });
    request.addEventListener('error', () => {
      reject(new Error('Video upload failed. Check your connection and try again.'));
    });
    request.addEventListener('abort', () => {
      reject(new Error('Video upload was cancelled.'));
    });
    request.send(formData);
  });
}
