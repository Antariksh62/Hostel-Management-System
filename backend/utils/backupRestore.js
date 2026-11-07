const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");

/**
 * Calculates SHA256 checksum of a file.
 */
function getFileChecksum(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256");
    hash.update(fileBuffer);
    return hash.digest("hex");
}

/**
 * Copies a directory recursively.
 */
function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Performs a comprehensive system backup of MongoDB collections and uploaded media.
 */
async function performBackup(options = {}) {
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = options.outDir || path.join(__dirname, "..", "backups", `backup_${backupTimestamp}`);
    const dbDir = path.join(outDir, "db");
    const mediaDir = path.join(outDir, "media");
    const uploadsDir = options.uploadsDir || path.join(__dirname, "..", "uploads");

    fs.mkdirSync(dbDir, { recursive: true });
    fs.mkdirSync(mediaDir, { recursive: true });

    // Connect to source DB if not connected
    let disconnectOnFinish = false;
    if (mongoose.connection.readyState !== 1) {
        const sourceUri = options.sourceDbUri || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB";
        await mongoose.connect(sourceUri);
        disconnectOnFinish = true;
    }

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const manifest = {
        backupId: `hostelhub_backup_${backupTimestamp}`,
        timestamp: new Date().toISOString(),
        sourceDatabase: mongoose.connection.name,
        collections: {},
        mediaFiles: [],
        totalMediaFiles: 0,
        status: "IN_PROGRESS"
    };

    console.log(`[Backup] Starting backup to: ${outDir}`);

    // 1. Dump all database collections
    for (const colInfo of collections) {
        const colName = colInfo.name;
        if (colName.startsWith("system.")) continue;

        const collection = db.collection(colName);
        const docs = await collection.find({}).toArray();
        const jsonPath = path.join(dbDir, `${colName}.json`);

        fs.writeFileSync(jsonPath, JSON.stringify(docs, null, 2), "utf8");
        manifest.collections[colName] = docs.length;
        console.log(`  ✓ Exported ${colName}: ${docs.length} documents`);
    }

    // 2. Backup uploaded media files with checksums
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
            const srcPath = path.join(uploadsDir, file);
            if (fs.statSync(srcPath).isFile()) {
                const destPath = path.join(mediaDir, file);
                fs.copyFileSync(srcPath, destPath);
                const checksum = getFileChecksum(destPath);
                manifest.mediaFiles.push({
                    filename: file,
                    sizeBytes: fs.statSync(destPath).size,
                    sha256: checksum
                });
            }
        }
        manifest.totalMediaFiles = manifest.mediaFiles.length;
        console.log(`  ✓ Backed up ${manifest.totalMediaFiles} media files`);
    }

    manifest.status = "COMPLETED";
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    console.log(`[Backup] Completed successfully: ${manifest.backupId}`);

    if (disconnectOnFinish) {
        await mongoose.disconnect();
    }

    return {
        success: true,
        backupPath: outDir,
        manifest
    };
}

/**
 * Restores a backup to a specified target database and target media directory.
 * Includes integrity verification for complaint media references.
 */
async function performRestore(options = {}) {
    const backupDir = options.backupDir;
    const targetDbUri = options.targetDbUri || "mongodb://127.0.0.1:27017/hostelDB_backup_drill_test";
    const targetUploadsDir = options.targetUploadsDir || path.join(__dirname, "..", "test_uploads_restore");

    if (!backupDir || !fs.existsSync(backupDir)) {
        throw new Error(`Backup directory not found: ${backupDir}`);
    }

    const manifestPath = path.join(backupDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest not found in backup directory: ${manifestPath}`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const dbDir = path.join(backupDir, "db");
    const mediaDir = path.join(backupDir, "media");

    console.log(`[Restore] Restoring ${manifest.backupId} to target DB: ${targetDbUri}`);

    // Connect to TARGET database independently
    const targetConn = await mongoose.createConnection(targetDbUri).asPromise();
    const targetDb = targetConn.db;

    // Safety: ensure we are operating on an isolated database if drill mode
    if (targetDb.databaseName === "hostelDB" && !options.allowPrimaryOverwrite) {
        await targetConn.close();
        throw new Error("Refusing to overwrite primary database 'hostelDB' without explicit allowPrimaryOverwrite flag.");
    }

    const restoredCounts = {};

    // 1. Restore database collections
    const files = fs.readdirSync(dbDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
        const colName = file.replace(/\.json$/, "");
        const rawData = fs.readFileSync(path.join(dbDir, file), "utf8");
        const docs = JSON.parse(rawData);

        // Convert ISO date strings and ObjectId strings back to native BSON types
        const bsonDocs = docs.map(doc => {
            return JSON.parse(JSON.stringify(doc), (key, value) => {
                if (typeof value === "string") {
                    // Check for ISO Date format
                    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
                        return new Date(value);
                    }
                    // Check for 24-hex ObjectId pattern if key ends with Id or is _id
                    if ((key === "_id" || key.endsWith("Id")) && /^[a-fA-F0-9]{24}$/.test(value)) {
                        return new mongoose.Types.ObjectId(value);
                    }
                }
                return value;
            });
        });

        const collection = targetDb.collection(colName);
        await collection.deleteMany({}); // Clear target collection for clean drill

        if (bsonDocs.length > 0) {
            await collection.insertMany(bsonDocs);
        }
        restoredCounts[colName] = bsonDocs.length;
        console.log(`  ✓ Restored ${colName}: ${bsonDocs.length} documents`);
    }

    // 2. Restore media directory
    fs.mkdirSync(targetUploadsDir, { recursive: true });
    if (fs.existsSync(mediaDir)) {
        copyDirSync(mediaDir, targetUploadsDir);
        console.log(`  ✓ Restored media files to: ${targetUploadsDir}`);
    }

    // 3. Media Reference Integrity Verification Pass
    console.log(`[Restore] Running Media Reference Integrity Verification...`);
    const complaintsCol = targetDb.collection("complaints");
    const restoredComplaints = await complaintsCol.find({}).toArray();

    let totalMediaReferences = 0;
    let verifiedMediaReferences = 0;
    const brokenReferences = [];

    for (const c of restoredComplaints) {
        const refsToCheck = [];
        if (Array.isArray(c.media)) {
            c.media.forEach(m => refsToCheck.push({ url: m.url, source: "complaint.media" }));
        }
        if (c.image) {
            refsToCheck.push({ url: c.image, source: "complaint.image" });
        }
        if (c.feedback?.media && Array.isArray(c.feedback.media)) {
            c.feedback.media.forEach(m => refsToCheck.push({ url: m.url, source: "complaint.feedback.media" }));
        }
        if (Array.isArray(c.beforePhotos)) {
            c.beforePhotos.forEach(p => refsToCheck.push({ url: p, source: "complaint.beforePhotos" }));
        }
        if (Array.isArray(c.afterPhotos)) {
            c.afterPhotos.forEach(p => refsToCheck.push({ url: p, source: "complaint.afterPhotos" }));
        }

        for (const ref of refsToCheck) {
            totalMediaReferences++;
            const filename = path.basename(ref.url);
            const expectedPath = path.join(targetUploadsDir, filename);

            if (fs.existsSync(expectedPath)) {
                verifiedMediaReferences++;
            } else {
                brokenReferences.push({
                    complaintId: c._id.toString(),
                    title: c.title,
                    source: ref.source,
                    url: ref.url,
                    expectedPath
                });
            }
        }
    }

    console.log(`[Restore Verification] Total References: ${totalMediaReferences} | Verified: ${verifiedMediaReferences} | Broken: ${brokenReferences.length}`);

    await targetConn.close();

    return {
        success: brokenReferences.length === 0,
        targetDatabase: targetDb.databaseName,
        restoredCounts,
        mediaVerification: {
            totalMediaReferences,
            verifiedMediaReferences,
            brokenReferencesCount: brokenReferences.length,
            brokenReferences
        }
    };
}

module.exports = {
    performBackup,
    performRestore,
    getFileChecksum
};

