import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { logger } from '../config/logger';

// 15 MB maximum file upload size
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// Allowed MIME types for tax, financial, identity proofs, and business documents
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.php3', '.php4', '.php5', '.phtml',
  '.js', '.vbs', '.py', '.rb', '.pl', '.cgi', '.jar', '.war', '.ear', '.msi', '.com',
  '.scr', '.hta', '.cpl', '.msc', '.ps1', '.ps2', '.psc1', '.psc2', '.reg', '.ws', '.wsf',
]);

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // 1. Check MIME type
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(
        ApiError.badRequest(
          `Invalid file format: "${file.mimetype}". Permitted formats are PDF, JPEG, PNG, WEBP, DOC, DOCX, XLS, XLSX, and CSV.`
        )
      );
    }

    // 2. Dangerous extension check & double extension check (e.g. invoice.pdf.exe)
    const originalName = file.originalname.toLowerCase();
    const parts = originalName.split('.');
    if (parts.length > 1) {
      for (const part of parts) {
        if (DANGEROUS_EXTENSIONS.has(`.${part}`)) {
          return cb(ApiError.badRequest('Executable and script file uploads are strictly forbidden.'));
        }
      }
    }

    cb(null, true);
  },
});

/**
 * Validates binary magic byte signatures and scans uploaded document buffers for malicious content.
 */
export function scanUploadedFile(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file || !req.file.buffer) {
    return next();
  }

  const buffer = req.file.buffer;
  const mime = req.file.mimetype;
  const fileName = req.file.originalname;

  // 1. Verify buffer size
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return next(ApiError.badRequest(`Uploaded file exceeds the maximum 15MB limit (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`));
  }

  if (buffer.length === 0) {
    return next(ApiError.badRequest('Uploaded file is empty (0 bytes).'));
  }

  // 2. Check Magic Byte Signatures
  const isPdf = buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF; // \xFF\xD8\xFF
  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 && buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A; // \x89PNG\r\n\x1a\n
  const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  const isZipOffice = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) && (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08); // PK.. (DOCX / XLSX)
  const isLegacyOffice = buffer.length >= 8 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0; // DOC / XLS OLE2

  // Executable signatures check (MZ for DOS/PE Windows executables, ELF for Linux, Mach-O for Mac)
  const isWindowsExe = buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A; // MZ
  const isLinuxElf = buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46; // \x7FELF
  const isMachO = buffer.length >= 4 && ((buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA && buffer[3] === 0xCE) || (buffer[0] === 0xCF && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE));

  if (isWindowsExe || isLinuxElf || isMachO) {
    logger.warn('[Security] Malicious executable header detected during upload:', { fileName, mime });
    return next(ApiError.badRequest('Security scan failed: Binary executable payload detected. Upload rejected.'));
  }

  // Verify binary type matches claimed MIME type
  if (mime === 'application/pdf' && !isPdf) {
    return next(ApiError.badRequest('File signature mismatch: File claims to be a PDF but lacks valid PDF magic bytes.'));
  }
  if (mime === 'image/jpeg' && !isJpeg) {
    return next(ApiError.badRequest('File signature mismatch: File claims to be a JPEG image but lacks valid JPEG magic bytes.'));
  }
  if (mime === 'image/png' && !isPng) {
    return next(ApiError.badRequest('File signature mismatch: File claims to be a PNG image but lacks valid PNG magic bytes.'));
  }
  if (mime === 'image/webp' && !isWebp) {
    return next(ApiError.badRequest('File signature mismatch: File claims to be a WEBP image but lacks valid WEBP magic bytes.'));
  }
  if (
    (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
     mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') &&
    !isZipOffice
  ) {
    return next(ApiError.badRequest('File signature mismatch: File claims to be an Office document but lacks valid Office XML headers.'));
  }
  if (
    (mime === 'application/msword' || mime === 'application/vnd.ms-excel') &&
    !isLegacyOffice &&
    !isZipOffice
  ) {
    return next(ApiError.badRequest('File signature mismatch: File claims to be a legacy Office document but lacks valid OLE2/Zip headers.'));
  }

  // 3. String content scan for text/csv, SVG, HTML injection, and embedded web scripts
  const sampleSize = Math.min(buffer.length, 64 * 1024); // Inspect first 64KB
  const contentSample = buffer.toString('utf8', 0, sampleSize).toLowerCase();

  const maliciousSignatures = [
    '<script',
    'javascript:',
    '<?php',
    '<%',
    'eval(',
    'base64_decode',
    'powershell',
    'cmd.exe',
    '/bin/sh',
    '/bin/bash',
    'wscript.shell',
    'system(',
    'passthru(',
    'shell_exec(',
  ];

  // If file is CSV or plain text, scan for malicious injection or formula execution
  if (mime === 'text/csv') {
    for (const pattern of maliciousSignatures) {
      if (contentSample.includes(pattern)) {
        logger.warn('[Security] Script injection signature detected in CSV upload:', { fileName, pattern });
        return next(ApiError.badRequest(`Security scan failed: Disallowed script pattern "${pattern}" found in document.`));
      }
    }
  }

  // 4. Sanitize original filename (remove control characters & path traversal sequences)
  req.file.originalname = fileName.replace(/[/\\?%*:|"<>]/g, '_').trim();

  logger.info('🛡️ Upload security scan passed successfully:', {
    fileName: req.file.originalname,
    sizeBytes: buffer.length,
    mimeType: mime,
  });

  next();
}
