const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { v4: uuidv4 } = require("uuid");
const FileType = require("file-type");

// ─── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm"]);
const ALL_ALLOWED_MIME   = new Set([...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME]);

// ─── Storage: UUID filenames (no user-controlled strings hit the filesystem) ───
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, "uploads/"),
    filename:    (_req, file,  cb) => {
        const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
        cb(null, `${uuidv4()}${ext}`);
    }
});

// ─── Pre-upload MIME filter (client-reported, first line of defence) ──────────
const fileFilter = (_req, file, cb) => {
    if (ALL_ALLOWED_MIME.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(
            "File type not allowed. Accepted: images (jpeg/png/gif/webp) and videos (mp4/webm)."
        ));
    }
};

// ─── Multer instance ─────────────────────────────────────────────────────────
// Accepts up to 5 images + 1 video per request, 20 MB each.
const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB per file
        files: 6                    // 5 images + 1 video max
    },
    fileFilter
});

// ─── Post-upload magic-byte validation ────────────────────────────────────────
// Reads the actual file bytes to verify the MIME type matches the extension.
// Malicious files with spoofed extensions (e.g. trojan.exe renamed to photo.jpg)
// are caught here and deleted from disk.
const validateFileMagicBytes = async (req, res, next) => {
    const allFiles = [
        ...(req.files?.images || []),
        ...(req.files?.video  || []),
        req.file                        // backward compat with upload.single()
    ].filter(Boolean);

    for (const file of allFiles) {
        const type = await FileType.fromFile(file.path);
        if (!type || !ALL_ALLOWED_MIME.has(type.mime)) {
            // Delete the offending file immediately
            try { fs.unlinkSync(file.path); } catch (_) {}
            return res.status(400).json({
                message: `File "${file.originalname}" failed security validation. Only real images/videos are accepted.`
            });
        }
    }
    next();
};

module.exports = { upload, validateFileMagicBytes };
