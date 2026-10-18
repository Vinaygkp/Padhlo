/**
 * Persistent Cloudflare R2 & Server Storage Service
 * Fully supports Cloudflare R2 via its S3-compatible API, with AWS S3 compatibility
 * and zero-data-loss local persistent volume fallback.
 *
 * Designed to strictly adhere to Cloudflare R2's free-tier allowance:
 * - 10 GB storage per month free
 * - 1,000,000 Class A operations (write/put, list) free
 * - 10,000,000 Class B operations (read/get, head) free
 * - 0 egress fees (free bandwidth!)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Ensure local persistent directories exist
const PERSISTENT_DIR = path.join(__dirname, '../../uploads/pdf_notes');
const PERSISTENT_PROFILES_DIR = path.join(__dirname, '../../uploads/profiles');
const PERSISTENT_IMAGES_DIR = path.join(__dirname, '../../uploads/images');

[PERSISTENT_DIR, PERSISTENT_PROFILES_DIR, PERSISTENT_IMAGES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Checks if Appwrite Cloud Storage is configured
 */
const isAppwriteConfigured = () => {
  return !!(
    process.env.APPWRITE_ENDPOINT?.trim() &&
    process.env.APPWRITE_PROJECT_ID?.trim() &&
    process.env.APPWRITE_API_KEY?.trim() &&
    process.env.APPWRITE_BUCKET_ID?.trim()
  );
};

/**
 * Returns safe Appwrite status without exposing secrets
 */
const getAppwriteStatus = () => {
  const endpoint = process.env.APPWRITE_ENDPOINT?.trim();
  const projectId = process.env.APPWRITE_PROJECT_ID?.trim();
  const hasApiKey = Boolean(process.env.APPWRITE_API_KEY?.trim());
  const bucketId = process.env.APPWRITE_BUCKET_ID?.trim();

  return {
    configured: Boolean(endpoint && projectId && hasApiKey && bucketId),
    endpoint: endpoint || null,
    projectId: projectId ? `${projectId.slice(0, 4)}...${projectId.slice(-4)}` : null,
    hasApiKey,
    bucketId: bucketId ? `${bucketId.slice(0, 4)}...${bucketId.slice(-4)}` : null,
  };
};

let cachedAppwriteStorage = null;
const getAppwriteStorage = () => {
  if (!isAppwriteConfigured()) return null;
  if (!cachedAppwriteStorage) {
    const { Client, Storage } = require('node-appwrite');
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT.trim())
      .setProject(process.env.APPWRITE_PROJECT_ID.trim())
      .setKey(process.env.APPWRITE_API_KEY.trim());
    cachedAppwriteStorage = new Storage(client);
  }
  return cachedAppwriteStorage;
};

/**
 * Checks if Cloudflare R2 is configured
 */
const isR2Configured = () => {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
};

/**
 * Checks if legacy AWS S3 is configured
 */
const isS3Configured = () => {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );
};

/**
 * Returns current primary storage provider
 * Priority: Appwrite Cloud Storage -> Cloudflare R2 -> AWS S3 -> Local Persistent
 */
const getActiveProvider = () => {
  if (isAppwriteConfigured()) return 'APPWRITE';
  if (isR2Configured()) return 'R2';
  if (isS3Configured()) return 'S3';
  return 'LOCAL_PERSISTENT';
};

/**
 * Gets S3-compatible client for Cloudflare R2
 */
let cachedR2Client = null;
const getR2Client = () => {
  if (!isR2Configured()) return null;
  if (!cachedR2Client) {
    cachedR2Client = new S3Client({
      region: 'auto', // Cloudflare R2 standard region
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return cachedR2Client;
};

/**
 * Gets S3-compatible client for legacy AWS S3
 */
let cachedS3Client = null;
const getS3Client = () => {
  if (!isS3Configured()) return null;
  if (!cachedS3Client) {
    cachedS3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      endpoint: process.env.AWS_ENDPOINT || undefined,
    });
  }
  return cachedS3Client;
};

/**
 * Sanitize filename to prevent directory traversal or invalid characters
 */
function sanitizeFileName(filename) {
  return (filename || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Generic file upload supporting R2, S3, and Local Disk
 * Generates collision-resistant unique object keys.
 */
async function uploadFilePermanently({
  buffer,
  originalFilename,
  mimeType,
  folder = 'studyhub_pdfs',
  uniqueFilename,
}) {
  const safeBase = sanitizeFileName(originalFilename);
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const safeName = uniqueFilename || `${Date.now()}-${randomSuffix}-${safeBase}`;
  const objectKey = `${folder}/${safeName}`;

  // 1. Prioritize Appwrite Cloud Storage
  if (isAppwriteConfigured()) {
    const isPdf = mimeType === 'application/pdf' || safeBase.toLowerCase().endsWith('.pdf');
    const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(safeBase);

    if (!isPdf && !isImage) {
      throw new Error(`Unsupported file format (${mimeType || 'unknown'}). Only PDF documents and image files (JPG, PNG, WEBP, GIF) are allowed.`);
    }

    const maxLimit = isPdf ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
    if (buffer.length > maxLimit) {
      throw new Error(`File size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed limit of ${maxLimit / (1024 * 1024)}MB.`);
    }

    try {
      const { ID } = require('node-appwrite');
      const { InputFile } = require('node-appwrite/file');
      const appwriteStorage = getAppwriteStorage();
      const bucketId = process.env.APPWRITE_BUCKET_ID.trim();

      const fileId = ID.unique();
      const inputFile = InputFile.fromBuffer(buffer, safeName);

      const uploaded = await appwriteStorage.createFile(bucketId, fileId, inputFile);
      if (!uploaded || !uploaded.$id) {
        throw new Error('Appwrite Storage did not return a valid file ID.');
      }

      return {
        provider: 'APPWRITE',
        key: uploaded.$id,
        fileId: uploaded.$id,
        bucket: bucketId,
        fileUrl: `/api/files/download/${encodeURIComponent(uploaded.$id)}`,
        storageFilename: safeName,
        originalFilename,
        mimeType: mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
        size: buffer.length,
      };
    } catch (err) {
      console.error('❌ Appwrite Cloud Storage upload error:', err.message);
      throw new Error(`Appwrite Storage upload failed: ${err.message}`);
    }
  }

  // 2. Fallback to Cloudflare R2
  if (isR2Configured()) {
    try {
      const client = getR2Client();
      const bucketName = process.env.R2_BUCKET_NAME;

      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: buffer,
          ContentType: mimeType || 'application/octet-stream',
          Metadata: {
            originalName: encodeURIComponent(originalFilename || 'file'),
            uploadedAt: new Date().toISOString(),
            retention: 'permanent',
          },
        })
      );

      // Verify the object physically exists in R2
      const verified = await verifyFileExists({ provider: 'R2', key: objectKey, bucket: bucketName });
      if (!verified) {
        throw new Error('R2 PutObject verification check failed.');
      }

      // If a public custom domain is configured for R2
      const publicBase = process.env.R2_PUBLIC_BASE_URL
        ? process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '')
        : null;
      const fileUrl = publicBase
        ? `${publicBase}/${objectKey}`
        : `/api/files/download/${encodeURIComponent(objectKey)}`;

      return {
        provider: 'R2',
        key: objectKey,
        bucket: bucketName,
        fileUrl,
        storageFilename: safeName,
        originalFilename,
        mimeType,
        size: buffer.length,
      };
    } catch (err) {
      console.warn('⚠️ Cloudflare R2 upload error, falling back to local persistent volume:', err.message);
    }
  }

  // 2. Fallback to AWS S3 if configured
  if (isS3Configured()) {
    try {
      const client = getS3Client();
      const bucketName = process.env.AWS_S3_BUCKET;

      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: buffer,
          ContentType: mimeType || 'application/octet-stream',
          Metadata: {
            originalName: encodeURIComponent(originalFilename || 'file'),
            uploadedAt: new Date().toISOString(),
          },
        })
      );

      const publicOrSignedUrl = process.env.AWS_CLOUDFRONT_URL
        ? `${process.env.AWS_CLOUDFRONT_URL}/${objectKey}`
        : `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${objectKey}`;

      return {
        provider: 'S3',
        key: objectKey,
        bucket: bucketName,
        fileUrl: publicOrSignedUrl,
        storageFilename: safeName,
        originalFilename,
        mimeType,
        size: buffer.length,
      };
    } catch (err) {
      console.warn('⚠️ AWS S3 upload error, preserving on persistent local storage:', err.message);
    }
  }

  // 3. Guaranteed Local Persistent Storage Fallback
  let targetDir = PERSISTENT_DIR;
  let urlPrefix = '/uploads/pdf_notes';
  if (folder === 'profiles') {
    targetDir = PERSISTENT_PROFILES_DIR;
    urlPrefix = '/uploads/profiles';
  } else if (folder === 'images' || folder === 'short_notes') {
    targetDir = PERSISTENT_IMAGES_DIR;
    urlPrefix = '/uploads/images';
  }

  const targetPath = path.join(targetDir, safeName);
  await fs.promises.writeFile(targetPath, buffer);

  return {
    provider: 'LOCAL_PERSISTENT',
    key: safeName,
    bucket: 'local-persistent-volume',
    fileUrl: `${urlPrefix}/${safeName}`,
    storageFilename: safeName,
    originalFilename,
    mimeType,
    size: buffer.length,
    localPath: targetPath,
  };
}

/**
 * Backward compatibility alias for PDF notes
 */
async function uploadPdfPermanently(params) {
  return uploadFilePermanently({ ...params, folder: 'studyhub_pdfs' });
}

/**
 * Generates a short-lived cryptographically signed URL for authorized download/viewing.
 * For private R2/S3 buckets: returns secure presigned URL.
 * For local storage: returns backend file streaming path.
 */
async function getSignedDownloadUrl({ provider, key, bucket, expiresIn = 3600, fileName }) {
  if (provider === 'APPWRITE') {
    return `/api/files/download/${encodeURIComponent(key)}`;
  }

  if (provider === 'R2' && isR2Configured()) {
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: bucket || process.env.R2_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: fileName ? `inline; filename="${sanitizeFileName(fileName)}"` : undefined,
    });
    return await getSignedUrl(client, command, { expiresIn });
  }

  if (provider === 'S3' && isS3Configured()) {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket || process.env.AWS_S3_BUCKET,
      Key: key,
      ResponseContentDisposition: fileName ? `inline; filename="${sanitizeFileName(fileName)}"` : undefined,
    });
    return await getSignedUrl(client, command, { expiresIn });
  }

  // Local persistent storage
  const filename = path.basename(key);
  return `/uploads/pdf_notes/${filename}`;
}

/**
 * Retrieves a readable stream for a file from Appwrite, R2, S3, or local storage.
 * Used for backend-authenticated streaming without exposing credentials to clients.
 */
async function getFileStream({ provider, key, bucket }) {
  if (provider === 'APPWRITE' && isAppwriteConfigured()) {
    const appwriteStorage = getAppwriteStorage();
    const bucketId = bucket || process.env.APPWRITE_BUCKET_ID.trim();
    
    let fileMeta = null;
    try {
      fileMeta = await appwriteStorage.getFile(bucketId, key);
    } catch {
      // If getFile fails or scope limited, proceed with direct download
    }

    const arrayBuffer = await appwriteStorage.getFileDownload(bucketId, key);
    const buffer = Buffer.from(arrayBuffer);
    const { Readable } = require('stream');

    let contentType = fileMeta?.mimeType || 'application/octet-stream';
    if (contentType === 'application/octet-stream') {
      const fileName = fileMeta?.name || key;
      if (fileName.toLowerCase().endsWith('.pdf')) contentType = 'application/pdf';
      else if (/\.(jpg|jpeg)$/i.test(fileName)) contentType = 'image/jpeg';
      else if (/\.png$/i.test(fileName)) contentType = 'image/png';
      else if (/\.webp$/i.test(fileName)) contentType = 'image/webp';
      else if (/\.gif$/i.test(fileName)) contentType = 'image/gif';
    }

    return {
      stream: Readable.from(buffer),
      buffer,
      fileName: fileMeta?.name || key,
      contentType,
      contentLength: buffer.length,
      lastModified: fileMeta?.$updatedAt ? new Date(fileMeta.$updatedAt) : new Date(),
    };
  }

  if (provider === 'R2' && isR2Configured()) {
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: bucket || process.env.R2_BUCKET_NAME,
      Key: key,
    });
    const response = await client.send(command);
    return {
      stream: response.Body,
      contentType: response.ContentType || 'application/pdf',
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
    };
  }

  if (provider === 'S3' && isS3Configured()) {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket || process.env.AWS_S3_BUCKET,
      Key: key,
    });
    const response = await client.send(command);
    return {
      stream: response.Body,
      contentType: response.ContentType || 'application/pdf',
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
    };
  }

  // Local storage lookup
  const candidates = [
    path.join(PERSISTENT_DIR, path.basename(key)),
    path.join(PERSISTENT_PROFILES_DIR, path.basename(key)),
    path.join(PERSISTENT_IMAGES_DIR, path.basename(key)),
    path.join(__dirname, '../../uploads', path.basename(key)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const stat = await fs.promises.stat(candidate);
      return {
        stream: fs.createReadStream(candidate),
        contentType: key.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
        contentLength: stat.size,
        lastModified: stat.mtime,
      };
    }
  }

  return null;
}

/**
 * Permanently deletes a file from cloud or persistent storage.
 * MUST only be invoked after explicit Admin authorization.
 */
async function deleteFilePermanently({ provider, key, bucket }) {
  if (provider === 'APPWRITE' && isAppwriteConfigured()) {
    try {
      const appwriteStorage = getAppwriteStorage();
      const bucketId = bucket || process.env.APPWRITE_BUCKET_ID.trim();
      await appwriteStorage.deleteFile(bucketId, key);
      return { success: true };
    } catch (err) {
      console.error('Failed to delete from Appwrite Cloud Storage:', err.message);
      throw err;
    }
  }

  if (provider === 'R2' && isR2Configured()) {
    try {
      const client = getR2Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket || process.env.R2_BUCKET_NAME,
          Key: key,
        })
      );
      return { success: true };
    } catch (err) {
      console.error('Failed to delete from Cloudflare R2:', err.message);
      throw err;
    }
  }

  if (provider === 'S3' && isS3Configured()) {
    try {
      const client = getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket || process.env.AWS_S3_BUCKET,
          Key: key,
        })
      );
      return { success: true };
    } catch (err) {
      console.error('Failed to delete from AWS S3:', err.message);
      throw err;
    }
  }

  // Local deletion
  const candidates = [
    path.join(PERSISTENT_DIR, path.basename(key)),
    path.join(PERSISTENT_PROFILES_DIR, path.basename(key)),
    path.join(PERSISTENT_IMAGES_DIR, path.basename(key)),
    path.join(__dirname, '../../uploads', path.basename(key)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      await fs.promises.unlink(candidate);
    }
  }

  return { success: true };
}

/**
 * Backward compatibility alias for PDF deletion
 */
async function deletePdfPermanently(params) {
  return deleteFilePermanently(params);
}

/**
 * Verifies whether the file physically exists in storage
 */
async function verifyFileExists({ provider, key, bucket }) {
  if (provider === 'APPWRITE' && isAppwriteConfigured()) {
    try {
      const appwriteStorage = getAppwriteStorage();
      const bucketId = bucket || process.env.APPWRITE_BUCKET_ID.trim();
      const file = await appwriteStorage.getFile(bucketId, key);
      return Boolean(file && file.$id);
    } catch {
      return false;
    }
  }

  if (provider === 'R2' && isR2Configured()) {
    try {
      const client = getR2Client();
      await client.send(
        new HeadObjectCommand({
          Bucket: bucket || process.env.R2_BUCKET_NAME,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  if (provider === 'S3' && isS3Configured()) {
    try {
      const client = getS3Client();
      await client.send(
        new HeadObjectCommand({
          Bucket: bucket || process.env.AWS_S3_BUCKET,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  const candidates = [
    path.join(PERSISTENT_DIR, path.basename(key)),
    path.join(PERSISTENT_PROFILES_DIR, path.basename(key)),
    path.join(PERSISTENT_IMAGES_DIR, path.basename(key)),
    path.join(__dirname, '../../uploads', path.basename(key)),
  ];

  return candidates.some((c) => fs.existsSync(c));
}

/**
 * Backward compatibility alias
 */
async function verifyPdfExists(params) {
  return verifyFileExists(params);
}

/**
 * List files from Appwrite Storage (Admin only)
 */
async function listAppwriteFiles({ limit = 25, offset = 0 } = {}) {
  if (!isAppwriteConfigured()) {
    throw new Error('Appwrite Cloud Storage is not configured in backend/.env.');
  }
  const appwriteStorage = getAppwriteStorage();
  const bucketId = process.env.APPWRITE_BUCKET_ID.trim();
  return await appwriteStorage.listFiles(bucketId);
}

/**
 * Safe migration utility: copies a local file to R2 without deleting the local source.
 * Verifies R2 persistence before returning updated metadata.
 */
async function migrateLocalFileToR2(localPath, folder = 'studyhub_pdfs') {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured. Provide R2 credentials before migrating.');
  }

  if (!fs.existsSync(localPath)) {
    throw new Error(`Local file not found at ${localPath}`);
  }

  const buffer = await fs.promises.readFile(localPath);
  const originalFilename = path.basename(localPath);
  const mimeType = originalFilename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';

  const uploadResult = await uploadFilePermanently({
    buffer,
    originalFilename,
    mimeType,
    folder,
  });

  if (uploadResult.provider !== 'R2') {
    throw new Error('Migration upload to R2 did not succeed.');
  }

  const existsInR2 = await verifyFileExists({
    provider: 'R2',
    key: uploadResult.key,
    bucket: uploadResult.bucket,
  });

  if (!existsInR2) {
    throw new Error('R2 verification failed for migrated file.');
  }

  return uploadResult;
}

module.exports = {
  isAppwriteConfigured,
  getAppwriteStatus,
  listAppwriteFiles,
  isR2Configured,
  isS3Configured,
  getActiveProvider,
  uploadFilePermanently,
  uploadPdfPermanently,
  getSignedDownloadUrl,
  getFileStream,
  deleteFilePermanently,
  deletePdfPermanently,
  verifyFileExists,
  verifyPdfExists,
  migrateLocalFileToR2,
  PERSISTENT_DIR,
  PERSISTENT_PROFILES_DIR,
  PERSISTENT_IMAGES_DIR,
};
