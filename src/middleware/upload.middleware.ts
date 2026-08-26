import multer from 'multer';
import { ApiError } from '../utils/apiError';

// 15 MB maximum file upload size
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// Allowed MIME types for tax, financial, and KYC documents
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

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(
        ApiError.badRequest(
          `Invalid file format: "${file.mimetype}". Permitted file formats are PDF, JPEG, PNG, WEBP, DOC, DOCX, XLS, XLSX, and CSV.`
        )
      );
    }

    // Dangerous extension check
    const originalName = file.originalname.toLowerCase();
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.vbs', '.py', '.rb'];
    if (dangerousExtensions.some((ext) => originalName.endsWith(ext))) {
      return cb(ApiError.badRequest('Executable and script file uploads are strictly forbidden.'));
    }

    cb(null, true);
  },
});
