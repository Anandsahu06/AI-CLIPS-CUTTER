/**
 * Reusable utility to handle downloads with interactive prompts.
 * PC/Desktop: Asks where to save and what to name (using File System Access API or prompt fallback).
 * Mobile/Phone: Displays a pop-up confirmation asking "Do you want to download this [filetype]?".
 */

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export interface DownloadOptions {
  url: string;
  defaultName: string;
  fileType: 'video' | 'audio' | 'image';
  extension: 'mp4' | 'mp3' | 'png' | 'jpg' | 'jpeg';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export async function downloadFile({
  url,
  defaultName,
  fileType,
  extension,
  onStart,
  onEnd,
  onError,
}: DownloadOptions) {
  const label = fileType === 'video' ? 'video' : fileType === 'audio' ? 'audio' : 'thumbnail';

  // 1. Mobile Experience: Pop-up confirmation asking "Do you want to download this [filetype]?"
  if (isMobileDevice()) {
    const confirmed = window.confirm(`Do you want to download this ${label}?`);
    if (!confirmed) return;

    onStart?.();
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download ${label}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      
      // Ensure correct extension suffix
      let finalName = defaultName;
      if (!finalName.toLowerCase().endsWith(`.${extension}`)) {
        finalName = `${finalName}.${extension}`;
      }
      a.download = finalName;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      onEnd?.();
    } catch (err: any) {
      console.error(err);
      onError?.(err);
    }
    return;
  }

  // 2. PC/Desktop Experience: Ask where to save and what filename to use
  // Try File System Access API (showSaveFilePicker)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const mimeMap: Record<string, string> = {
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg'
      };

      const descriptionMap: Record<string, string> = {
        video: 'Video File',
        audio: 'Audio File',
        image: 'Image File'
      };

      const pickerOpts = {
        suggestedName: defaultName.toLowerCase().endsWith(`.${extension}`) 
          ? defaultName 
          : `${defaultName}.${extension}`,
        types: [{
          description: `${descriptionMap[fileType]} (*.${extension})`,
          accept: {
            [mimeMap[extension]]: [`.${extension}`]
          }
        }]
      };

      const fileHandle = await (window as any).showSaveFilePicker(pickerOpts);

      onStart?.();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch file from server`);
      const blob = await response.blob();

      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      onEnd?.();
      return;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled the native save dialog, exit quietly
        return;
      }
      console.warn('File System Access API failed or is not supported. Falling back to filename prompt:', err);
    }
  }

  // Fallback for Desktop: Prompt user for filename, and trigger download
  const suggestedFilename = defaultName.toLowerCase().endsWith(`.${extension}`)
    ? defaultName
    : `${defaultName}.${extension}`;

  const newName = window.prompt("Enter filename to save:", suggestedFilename);
  if (newName === null) {
    // User cancelled
    return;
  }

  const nameToUse = newName.trim() || suggestedFilename;
  let finalName = nameToUse;
  if (!finalName.toLowerCase().endsWith(`.${extension}`)) {
    finalName = `${finalName}.${extension}`;
  }

  onStart?.();
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${label}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = finalName;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    onEnd?.();
  } catch (err: any) {
    console.error(err);
    onError?.(err);
  }
}
