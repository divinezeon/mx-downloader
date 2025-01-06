const express = require('express');
const fs = require('fs');
const { Storage } = require('megajs');
const dotenv = require('dotenv');
const path = require('path');
const ytdlp = require('yt-dlp-exec');

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Constants
const DOWNLOAD_FOLDER = './downloads';
const LOGS_FOLDER = './logs';
const PORT = process.env.PORT || 3000;
const EMAIL = process.env.MEGA_EMAIL;
const PASSWORD = process.env.MEGA_PASSWORD;

// Ensure required folders exist
[DOWNLOAD_FOLDER, LOGS_FOLDER].forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
});


// Create a write stream for logging
function createLogStream(episodeNumber) {
    const logFile = path.join(LOGS_FOLDER, `episode_${episodeNumber}_${Date.now()}.log`);
    return fs.createWriteStream(logFile, { flags: 'a' });
}

// Log function with timestamp
function logWithTimestamp(logStream, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    logStream.write(logMessage);
}


let megaStorage = null;

// Initialize Mega storage with proper error handling
async function initializeMegaStorage() {
    try {
        if (megaStorage) {
            return; // Already initialized
        }

        megaStorage = new Storage({
            email: EMAIL,
            password: PASSWORD,
            keepalive: true, // Keep the connection alive
        });

        await new Promise((resolve, reject) => {
            megaStorage.once('ready', () => {
                console.log('Successfully logged in to Mega!');
                resolve();
            });

            megaStorage.once('error', (err) => {
                reject(new Error(`Mega initialization failed: ${err.message}`));
            });
        });
    } catch (error) {
        console.error('Failed to initialize Mega storage:', error);
        throw error;
    }
}

// Upload function with improved error handling
// Modified upload function with progress tracking
async function uploadToMega(filePath, fileName, logStream) {
    if (!megaStorage) {
        throw new Error('Mega storage not initialized');
    }

    return new Promise((resolve, reject) => {
        try {
            const stats = fs.statSync(filePath);
            const fileStream = fs.createReadStream(filePath);
            const totalSize = stats.size;
            let uploadedSize = 0;
            let lastProgressLog = 0;

            const uploadStream = megaStorage.upload({
                name: fileName,
                size: stats.size
            });

            // Track upload progress
            uploadStream.on('progress', (data) => {
                uploadedSize = data;
                const progressPercent = ((uploadedSize / totalSize) * 100).toFixed(2);

                // Log progress every 5%
                if (progressPercent - lastProgressLog >= 5) {
                    logWithTimestamp(logStream, `Upload Progress: ${progressPercent}% (${(uploadedSize / 1024 / 1024).toFixed(2)}MB / ${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
                    lastProgressLog = Math.floor(progressPercent / 5) * 5;
                }
            });

            uploadStream.on('complete', () => {
                logWithTimestamp(logStream, `Upload completed: ${fileName}`);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        logWithTimestamp(logStream, `Failed to delete local file ${filePath}: ${err.message}`);
                    } else {
                        logWithTimestamp(logStream, `Deleted local file: ${filePath}`);
                    }
                });
                resolve();
            });

            uploadStream.on('error', (err) => {
                logWithTimestamp(logStream, `Upload error: ${err.message}`);
                reject(err);
            });

            fileStream.pipe(uploadStream);
        } catch (error) {
            reject(error);
        }
    });
}
// Download and upload function using yt-dlp-exec
async function downloadAndUpload(url, episodeNumber) {
    const fileName = `My Girlfriend is An Alien S01E${String(episodeNumber).padStart(2, '0')} 1080p x264 Hindi.mp4`;
    const filePath = path.join(DOWNLOAD_FOLDER, fileName);
    const logStream = createLogStream(episodeNumber);

    try {
        logWithTimestamp(logStream, `Starting process for episode ${episodeNumber}`);
        logWithTimestamp(logStream, `URL: ${url}`);

        // Download video using yt-dlp-exec with progress tracking
        await ytdlp(url, {
            output: filePath,
            verbose: true,
            noCheckCertificates: true,
            progress: true,
            callback: (progress) => {
                if (progress.percent) {
                    logWithTimestamp(logStream, `Download Progress: ${progress.percent.toFixed(2)}% at ${progress.speed} - ETA: ${progress.eta}`);
                }
            }
        });

        logWithTimestamp(logStream, `Download completed for episode ${episodeNumber}`);

        // Upload to Mega
        await uploadToMega(filePath, fileName, logStream);

        logWithTimestamp(logStream, `Process completed for episode ${episodeNumber}`);
        logStream.end();

        return { success: true, message: `Successfully processed episode ${episodeNumber}` };
    } catch (error) {
        logWithTimestamp(logStream, `Error: ${error.message}\n${error.stack}`);
        logStream.end();

        return {
            success: false,
            message: `Failed to process episode ${episodeNumber}: ${error.message}`,
            details: error.stack
        };
    }
}

// API Routes
app.post('/download', async (req, res) => {
    const { urls } = req.body;

    if (!Array.isArray(urls)) {
        return res.status(400).json({ error: 'URLs must be provided as an array' });
    }

    try {
        await initializeMegaStorage();

        const results = [];
        for (let i = 0; i < urls.length; i++) {
            const result = await downloadAndUpload(urls[i], i + 1);
            results.push(result);
        }

        res.json({
            message: 'Processing completed',
            results
        });
    } catch (error) {
        console.error('Download process failed:', error);
        res.status(500).json({
            error: 'Failed to process downloads',
            details: error.message
        });
    }
});

// Get download status
app.get('/status', (req, res) => {
    try {
        const files = fs.readdirSync(DOWNLOAD_FOLDER);
        const logs = fs.readdirSync(LOGS_FOLDER).map(logFile => {
            const logPath = path.join(LOGS_FOLDER, logFile);
            const logContent = fs.readFileSync(logPath, 'utf-8');
            return {
                filename: logFile,
                content: logContent
            };
        });

        res.json({
            downloadingFiles: files,
            downloadFolder: DOWNLOAD_FOLDER,
            logs: logs
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get status',
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
