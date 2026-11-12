import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio privado para solicitudes: backend/uploads/requests
export const REQUESTS_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/requests');

// Garantizar existencia del directorio de subida
if (!fs.existsSync(REQUESTS_UPLOAD_DIR)) {
  fs.mkdirSync(REQUESTS_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(REQUESTS_UPLOAD_DIR)) {
      fs.mkdirSync(REQUESTS_UPLOAD_DIR, { recursive: true });
    }
    cb(null, REQUESTS_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Extensión segura a partir del nombre original
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueFileName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueFileName);
  },
});

const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error(
      'Formato de archivo no válido. Solo se admiten documentos PDF e imágenes JPG, PNG o WebP.'
    );
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter,
});

/**
 * Middleware para procesar la subida del archivo opcional 'attachment'.
 * Devuelve HTTP 400 si supera el tamaño o si el tipo MIME no está permitido.
 */
export const uploadRequestAttachment = (req, res, next) => {
  const handler = upload.single('attachment');

  handler(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          status: 'error',
          message: 'El archivo adjunto no puede superar los 5 MB de tamaño.',
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          status: 'error',
          message: err.message,
        });
      }
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Error al procesar el archivo adjunto.',
      });
    }
    next();
  });
};

export default uploadRequestAttachment;
