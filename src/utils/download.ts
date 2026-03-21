export async function downloadFile(url: string, suggestedName?: string) {
  const fallbackDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    if (suggestedName) {
      link.download = suggestedName;
    }
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = suggestedName || url.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    fallbackDownload();
  }
}
