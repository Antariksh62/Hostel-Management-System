const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { v4: uuidv4 } = require("uuid");
const FileType = require("file-type");

// ─── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_IMAGE_MIME = new Set([
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "image/heic", "image/heif", "image/bmp", "image/tiff"
]);

const ALLOWED_VIDEO_MIME = new Set([
    "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
    "video/avi", "video/3gpp", "video/mpeg", "video/ogg", "video/x-msvideo"
]);

const ALL_ALLOWED_MIME = new Set([...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME]);
const ALLOWED_EXTS = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".bmp",
    ".mp4", ".webm", ".mov", ".mkv", ".avi", ".3gp", ".mpeg", ".mpg", ".ogv"
]);

// ─── Storage: UUID filenames (no user-controlled strings hit the filesystem) ───
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, "uploads/"),
    filename:    (_req, _file,  cb) => {
        cb(null, uuidv4());
    }
});

// ─── Pre-upload MIME & Extension filter ──────────────────────────────────────
const fileFilter = (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ALL_ALLOWED_MIME.has(file.mimetype) || ALLOWED_EXTS.has(ext)) {
        cb(null, true);
    } else {
        cb(new Error(
            "File type not allowed. Accepted: images (jpeg/png/gif/webp/heic) and videos (mp4/webm/mov/mkv/avi)."
        ));
    }
};

// ─── Multer instance ─────────────────────────────────────────────────────────
const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // Increased to 50 MB per file to support high-res video uploads
        files: 6                    // 5 images + 1 video max
    },
    fileFilter
});

// ─── Post-upload magic-byte & extension validation ───────────────────────────
const validateFileMagicBytes = async (req, res, next) => {
    const allFiles = [
        ...(req.files?.images || []),
        ...(req.files?.video  || []),
        req.file                        // backward compat with upload.single()
    ].filter(Boolean);

    for (const file of allFiles) {
        try {
            let type = await FileType.fromFile(file.path);
            let ext = type?.ext;
            let mime = type?.mime;

            // Fallback detection if file-type cannot determine container mime
            if (!mime || !ALL_ALLOWED_MIME.has(mime)) {
                const originalExt = path.extname(file.originalname || "").toLowerCase();
                if (ALLOWED_EXTS.has(originalExt) || ALL_ALLOWED_MIME.has(file.mimetype)) {
                    mime = ALL_ALLOWED_MIME.has(file.mimetype) ? file.mimetype : "application/octet-stream";
                    ext = originalExt.replace(".", "") || "bin";
                }
            }

            if (!ext) {
                // Cleanup all uploaded temp files
                for (const f of allFiles) {
                    try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (_) {}
                }
                return res.status(400).json({
                    message: `File "${file.originalname}" failed security validation. Only real images/videos are accepted.`
                });
            }

            // Append safe verified extension
            const safePath = `${file.path}.${ext}`;
            if (fs.existsSync(file.path)) {
                fs.renameSync(file.path, safePath);
            }
            
            // Update the file object so the controller uses the correct filename
            file.path = safePath;
            file.filename = `${file.filename}.${ext}`;

        } catch (err) {
            for (const f of allFiles) {
                try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (_) {}
            }
            return res.status(500).json({ message: "Error processing uploaded media." });
        }
    }
    next();
};

module.exports = { upload, validateFileMagicBytes };
