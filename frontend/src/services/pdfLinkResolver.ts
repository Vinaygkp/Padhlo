/**
 * Utility to resolve in-app PDF preview URLs and external destinations
 * with robust local/Appwrite support and embedded PDF.js rendering.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '@/constants/api';
import { storage } from './storage';
import { sanitizePdfFileName } from './externalPdfViewerService';

export interface ResolvedPdfLinks {
  previewUrl: string;
  externalUrl: string;
  downloadUrl: string;
  isDrive: boolean;
  isFolder?: boolean;
  driveId?: string;
  displayLabel: string;
  isDirectPdf: boolean;
}

/**
 * Normalizes any backend or relative URL to a fully-qualified reachable endpoint.
 */
export function normalizeFileUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // If already wrapped in Google Docs Viewer, unwrap to inspect actual target
  if (url.includes('docs.google.com/gview') && url.includes('url=')) {
    try {
      const matchUrl = url.match(/[?&]url=([^&]+)/);
      if (matchUrl && matchUrl[1]) {
        url = decodeURIComponent(matchUrl[1]);
      }
    } catch {
      // Keep url as is if decoding fails
    }
  }

  // Handle relative backend paths like /api/...
  if (url.startsWith('/')) {
    url = `${API_BASE_URL}${url}`;
  }

  // Handle localhost mapping on physical Android devices / LAN
  if (Platform.OS === 'android' && url.includes('localhost:5000')) {
    url = url.replace('http://localhost:5000', API_BASE_URL);
  }
  if (Platform.OS === 'android' && url.includes('127.0.0.1:5000')) {
    url = url.replace('http://127.0.0.1:5000', API_BASE_URL);
  }

  return url;
}

/**
 * Resolves PDF links into safe in-app preview URLs and external targets.
 * Completely eliminates Google Docs Viewer 400 errors for private/LAN/Appwrite endpoints.
 */
export function resolvePdfLinks(rawUrl?: string, externalUrlOverride?: string): ResolvedPdfLinks {
  const normRaw = normalizeFileUrl(rawUrl);
  const normExt = normalizeFileUrl(externalUrlOverride);

  // Determine primary target: prefer direct file endpoint if available, else external URL
  let target = normRaw || normExt;
  if (!target && normExt) target = normExt;
  if (!target) {
    return {
      previewUrl: '',
      externalUrl: '',
      downloadUrl: '',
      isDrive: false,
      displayLabel: 'Open External Link',
      isDirectPdf: false,
    };
  }

  // 1. Google Drive Folder Formats
  const driveFolderMatch = target.match(/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|embeddedfolderview\?id=)([a-zA-Z0-9_-]+)/);
  if (driveFolderMatch && driveFolderMatch[1]) {
    const folderId = driveFolderMatch[1];
    return {
      isDrive: true,
      isFolder: true,
      driveId: folderId,
      previewUrl: `https://drive.google.com/embeddedfolderview?id=${folderId}#list`,
      externalUrl: `https://drive.google.com/drive/folders/${folderId}`,
      downloadUrl: `https://drive.google.com/drive/folders/${folderId}`,
      displayLabel: 'Open Google Drive Folder',
      isDirectPdf: false,
    };
  }

  // 2. Google Drive File Formats
  const driveFileMatch = target.match(/(?:drive\.google\.com\/(?:file\/d\/|(?:open|uc)\?(?:.*&)?id=)|docs\.google\.com\/(?:file|document)\/d\/)([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    const driveId = driveFileMatch[1];
    return {
      isDrive: true,
      isFolder: false,
      driveId,
      previewUrl: `https://drive.google.com/file/d/${driveId}/preview`,
      externalUrl: `https://drive.google.com/file/d/${driveId}/view?usp=sharing`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${driveId}`,
      displayLabel: 'Open in Google Drive',
      isDirectPdf: false,
    };
  }

  // 3. Direct PDF / Backend Appwrite Stream / Local File
  const isDirectPdf = 
    target.startsWith('file://') ||
    target.startsWith('content://') ||
    target.toLowerCase().endsWith('.pdf') ||
    target.includes('/api/notes/') ||
    target.includes('/api/files/download/') ||
    target.includes('/storage/buckets/') ||
    /\.pdf([?#]|$)/i.test(target);

  if (isDirectPdf) {
    return {
      isDrive: false,
      isDirectPdf: true,
      previewUrl: target,
      externalUrl: normExt || target,
      downloadUrl: target,
      displayLabel: 'Open in Google Drive / PDF App',
    };
  }

  // 4. Standard public web resource (e.g. NotesGallery page)
  return {
    isDrive: false,
    isDirectPdf: false,
    previewUrl: target,
    externalUrl: normExt || target,
    downloadUrl: target,
    displayLabel: 'Open Web Resource',
  };
}

/**
 * Loads a PDF file as a base64 string for direct, offline-ready rendering in WebView.
 * Works seamlessly with local file:// and content:// URIs (e.g. DocumentPicker),
 * cached files, and remote backend/Appwrite endpoints.
 */
export async function loadPdfBase64(fileUrl?: string, fileName?: string): Promise<string | null> {
  if (!fileUrl) return null;

  try {
    const sanitizedName = sanitizePdfFileName(fileName || 'document.pdf');
    const cacheDir = `${FileSystem.cacheDirectory}pdf_viewer_cache/`;
    const targetCachePath = `${cacheDir}${sanitizedName}`;
    const offlinePath = `${FileSystem.documentDirectory}studyhub_notes/${sanitizedName}`;

    // 1. If it's a local file:// URI
    if (fileUrl.startsWith('file://')) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUrl);
        if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
          return await FileSystem.readAsStringAsync(fileUrl, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      } catch (readErr) {
        console.warn('readAsStringAsync notice, attempting fetch/blob fallback:', readErr);
        // Fallback for DocumentPicker scoped URIs on Android Expo Go
        try {
          const res = await fetch(fileUrl);
          const blob = await res.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl.split(',')[1] || dataUrl);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          if (base64) {
            try {
              const dirInfo = await FileSystem.getInfoAsync(cacheDir);
              if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
              }
              await FileSystem.writeAsStringAsync(targetCachePath, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });
            } catch {}
            return base64;
          }
        } catch (blobErr) {
          console.warn('Native fetch blob rescue error:', blobErr);
        }
      }
    }

    // 2. If it's an Android content:// URI
    if (fileUrl.startsWith('content://')) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        }
        await FileSystem.copyAsync({ from: fileUrl, to: targetCachePath });
        return await FileSystem.readAsStringAsync(targetCachePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {
        try {
          return await FileSystem.readAsStringAsync(fileUrl, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {}
      }
    }

    // 3. Check if already saved in offline storage
    try {
      const offInfo = await FileSystem.getInfoAsync(offlinePath);
      if (offInfo.exists && offInfo.size && offInfo.size > 0) {
        return await FileSystem.readAsStringAsync(offlinePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    } catch {}

    // 4. Check if already in temporary cache
    try {
      const cacheInfo = await FileSystem.getInfoAsync(targetCachePath);
      if (cacheInfo.exists && cacheInfo.size && cacheInfo.size > 0) {
        return await FileSystem.readAsStringAsync(targetCachePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    } catch {}

    // 5. If it's a remote direct PDF or backend endpoint, download to cache first
    const isDirectRemotePdf =
      fileUrl.startsWith('http://') ||
      fileUrl.startsWith('https://') ||
      fileUrl.startsWith('/');

    if (isDirectRemotePdf && !fileUrl.includes('drive.google.com')) {
      const resolvedUrl = normalizeFileUrl(fileUrl);
      const token = await storage.getToken();
      const headers: Record<string, string> = { Accept: 'application/pdf' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      const dlResult = await FileSystem.downloadAsync(resolvedUrl, targetCachePath, { headers });
      if (dlResult && dlResult.uri) {
        const downloadedInfo = await FileSystem.getInfoAsync(dlResult.uri);
        if (downloadedInfo.exists && downloadedInfo.size && downloadedInfo.size > 0) {
          return await FileSystem.readAsStringAsync(dlResult.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      }
    }
  } catch (err) {
    console.warn('loadPdfBase64 notice:', err);
  }

  return null;
}

/**
 * Builds a responsive, dark-mode compatible HTML string for in-app PDF rendering
 * using Mozilla PDF.js. Works seamlessly inside Android and iOS WebViews.
 */
export function buildPdfViewerHtml(pdfUrl: string, token?: string, base64Data?: string): string {
  let authenticatedUrl = pdfUrl;
  if (token && (authenticatedUrl.includes('/api/notes/') || authenticatedUrl.includes('/api/files/download/')) && !authenticatedUrl.includes('token=')) {
    const separator = authenticatedUrl.includes('?') ? '&' : '?';
    authenticatedUrl = `${authenticatedUrl}${separator}token=${encodeURIComponent(token)}`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <title>Padhlo PDF Preview</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background-color: #0b0c10;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100%;
      width: 100%;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }
    #loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 50px 20px;
      gap: 14px;
      color: #8F9CAE;
      font-size: 13px;
      text-align: center;
    }
    .spinner {
      width: 34px;
      height: 34px;
      border: 3px solid rgba(139, 92, 246, 0.2);
      border-top-color: #8B5CF6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    #pdf-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 10px 8px;
      width: 100%;
    }
    .page-wrapper {
      width: 100%;
      max-width: 680px;
      background: #ffffff;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    canvas {
      display: block;
      width: 100% !important;
      height: auto !important;
    }
    .page-footer {
      background: #161a23;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      padding: 6px 0;
      border-top: 1px solid #283042;
    }
    #error-container {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: #cbd5e1;
      gap: 10px;
    }
    .error-title {
      font-size: 15px;
      font-weight: 700;
      color: #f87171;
    }
    .error-desc {
      font-size: 12px;
      line-height: 18px;
      color: #94a3b8;
      max-width: 290px;
    }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <div>Loading document pages...</div>
  </div>
  <div id="pdf-container"></div>
  <div id="error-container">
    <div class="error-title">In-App Preview Unavailable</div>
    <div class="error-desc">Please tap "External App" or "Save Offline" below to open and study this document.</div>
  </div>
  <script>
    (function() {
      var targetUrl = ${JSON.stringify(authenticatedUrl)};
      var base64Data = ${JSON.stringify(base64Data || null)};
      var container = document.getElementById('pdf-container');
      var loading = document.getElementById('loading');
      var errorBox = document.getElementById('error-container');

      function showError(err) {
        if (err) console.error('PDF view error:', err);
        loading.style.display = 'none';
        errorBox.style.display = 'flex';
      }

      if (typeof pdfjsLib === 'undefined') {
        showError('pdfjsLib is undefined');
        return;
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      var docTask;
      if (base64Data && base64Data.length > 0) {
        try {
          var raw = atob(base64Data);
          var uint8Array = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) {
            uint8Array[i] = raw.charCodeAt(i);
          }
          docTask = pdfjsLib.getDocument({ data: uint8Array });
        } catch (b64Err) {
          console.warn('Base64 decode failed, falling back to URL fetch:', b64Err);
          if (targetUrl && !targetUrl.startsWith('file://')) {
            docTask = pdfjsLib.getDocument({ url: targetUrl, withCredentials: false });
          } else {
            showError(b64Err);
            return;
          }
        }
      } else if (targetUrl) {
        docTask = pdfjsLib.getDocument({
          url: targetUrl,
          withCredentials: false
        });
      } else {
        showError('No target URL or document data');
        return;
      }

      docTask.promise.then(async function(pdfDoc) {
        loading.style.display = 'none';
        var totalPages = Math.min(pdfDoc.numPages, 40);
        for (var pageNum = 1; pageNum <= totalPages; pageNum++) {
          try {
            var page = await pdfDoc.getPage(pageNum);
            var viewport = page.getViewport({ scale: 1.5 });
            
            var wrap = document.createElement('div');
            wrap.className = 'page-wrapper';
            
            var canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            var ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            
            wrap.appendChild(canvas);
            
            var footer = document.createElement('div');
            footer.className = 'page-footer';
            footer.innerText = 'Page ' + pageNum + ' of ' + pdfDoc.numPages;
            wrap.appendChild(footer);
            
            container.appendChild(wrap);
          } catch(e) {
            console.error('Error on page ' + pageNum, e);
          }
        }
      }).catch(function(err) {
        console.error('PDF render error:', err);
        showError(err);
      });
    })();
  </script>
</body>
</html>`;
}
