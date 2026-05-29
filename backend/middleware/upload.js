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
// Patch 1: Save the file without any extension initially
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, "uploads/"),
    filename:    (_req, _file,  cb) => {
        cb(null, uuidv4()); // Do not trust or use file.originalname
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
// Patch 2: Dynamically append the safe, verified extension inside validateFileMagicBytes
const validateFileMagicBytes = async (req, res, next) => {
    const allFiles = [
        ...(req.files?.images || []),
        ...(req.files?.video  || []),
        req.file                        // backward compat with upload.single()
    ].filter(Boolean);

    for (const file of allFiles) {
        try {
            const type = await FileType.fromFile(file.path);
            if (!type || !ALL_ALLOWED_MIME.has(type.mime)) {
                // Patch: Delete ALL files uploaded in this request to prevent orphans
                for (const f of allFiles) {
                    try { fs.unlinkSync(f.path); } catch (_) {}
                }
                return res.status(400).json({
                    message: `File "${file.originalname}" failed security validation. Only real images/videos are accepted.`
                });
            }

            // Patch: Rename the file to include the trusted extension provided by file-type
            const safePath = `${file.path}.${type.ext}`;
            fs.renameSync(file.path, safePath);
            
            // Update the file object so the controller uses the correct filename
            file.path = safePath;
            file.filename = `${file.filename}.${type.ext}`;

        } catch (err) {
            // Patch: Catch read errors and clean up all files to prevent unhandled rejection crashes
            for (const f of allFiles) {
                try { fs.unlinkSync(f.path); } catch (_) {}
            }
            return res.status(500).json({ message: "Error processing file." });
        }
    }
    next();
};

module.exports = { upload, validateFileMagicBytes };
