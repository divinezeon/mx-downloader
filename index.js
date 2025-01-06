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

// Track active processes
const activeProcesses = new Map();

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
            keepalive: true,
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

// Upload function with cancellation support
async function uploadToMega(filePath, fileName, logStream, episodeNumber) {
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

            // Store upload stream in active processes
            activeProcesses.get(episodeNumber).uploadStream = uploadStream;

            // Track upload progress
            uploadStream.on('progress', (data) => {
                uploadedSize = data;
                const progressPercent = ((uploadedSize / totalSize) * 100).toFixed(2);

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
                activeProcesses.delete(episodeNumber);
                resolve();
            });

            uploadStream.on('error', (err) => {
                logWithTimestamp(logStream, `Upload error: ${err.message}`);
                activeProcesses.delete(episodeNumber);
                reject(err);
            });

            fileStream.pipe(uploadStream);
        } catch (error) {
            activeProcesses.delete(episodeNumber);
            reject(error);
        }
    });
}

// Download and upload function with cancellation support
async function downloadAndUpload(url, episodeNumber) {
    const fileName = `My Girlfriend is An Alien S01E${String(episodeNumber).padStart(2, '0')} 1080p x264 Hindi.mp4`;
    const filePath = path.join(DOWNLOAD_FOLDER, fileName);
    const logStream = createLogStream(episodeNumber);

    // Initialize process tracking
    activeProcesses.set(episodeNumber, {
        status: 'downloading',
        cancel: false,
        downloadProcess: null,
        uploadStream: null
    });

    try {
        logWithTimestamp(logStream, `Starting process for episode ${episodeNumber}`);
        logWithTimestamp(logStream, `URL: ${url}`);

        // Download video with cancellation support
        const process = ytdlp(url, {
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

        // Store download process
        activeProcesses.get(episodeNumber).downloadProcess = process;

        // Check for cancellation
        if (activeProcesses.get(episodeNumber)?.cancel) {
            throw new Error('Process cancelled by user');
        }

        await process;
        logWithTimestamp(logStream, `Download completed for episode ${episodeNumber}`);

        // Update status
        activeProcesses.get(episodeNumber).status = 'uploading';

        // Upload to Mega
        await uploadToMega(filePath, fileName, logStream, episodeNumber);

        logWithTimestamp(logStream, `Process completed for episode ${episodeNumber}`);
        logStream.end();
        activeProcesses.delete(episodeNumber);

        return { success: true, message: `Successfully processed episode ${episodeNumber}` };
    } catch (error) {
        logWithTimestamp(logStream, `Error: ${error.message}\n${error.stack}`);
        logStream.end();

        // Clean up if file exists
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logWithTimestamp(logStream, `Cleaned up file: ${filePath}`);
        }

        activeProcesses.delete(episodeNumber);
        return {
            success: false,
            message: `Failed to process episode ${episodeNumber}: ${error.message}`,
            details: error.stack
        };
    }
}

// API Routes
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

// Function to cancel a specific process
async function cancelProcess(episodeNumber) {
    const process = activeProcesses.get(episodeNumber);
    if (!process) return false;

    try {
        // Mark process for cancellation
        process.cancel = true;

        // Kill download process if it exists
        if (process.downloadProcess) {
            process.downloadProcess.cancel();
        }

        // Abort upload if it exists
        if (process.uploadStream) {
            process.uploadStream.abort();
        }

        // Clean up file if it exists
        const fileName = `My Girlfriend is An Alien S01E${String(episodeNumber).padStart(2, '0')} 1080p x264 Hindi.mp4`;
        const filePath = path.join(DOWNLOAD_FOLDER, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        activeProcesses.delete(episodeNumber);
        return true;
    } catch (error) {
        console.error(`Error cancelling process ${episodeNumber}:`, error);
        return false;
    }
}

// Cancel specific episode route
app.post('/cancel/:episodeNumber', async (req, res) => {
    const episodeNumber = parseInt(req.params.episodeNumber);

    if (isNaN(episodeNumber)) {
        return res.status(400).json({ error: 'Invalid episode number' });
    }

    const success = await cancelProcess(episodeNumber);

    if (success) {
        res.json({
            message: `Successfully cancelled process for episode ${episodeNumber}`,
            status: 'cancelled'
        });
    } else {
        res.status(404).json({
            error: 'No active process found for this episode or cancellation failed'
        });
    }
});

// Cancel all processes route
app.post('/cancelall', async (req, res) => {
    if (activeProcesses.size === 0) {
        return res.status(404).json({ error: 'No active processes found' });
    }

    const results = {
        successful: [],
        failed: []
    };

    // Create an array of episode numbers to avoid modification during iteration
    const episodeNumbers = Array.from(activeProcesses.keys());

    // Cancel each process
    for (const episodeNumber of episodeNumbers) {
        const success = await cancelProcess(episodeNumber);
        if (success) {
            results.successful.push(episodeNumber);
        } else {
            results.failed.push(episodeNumber);
        }
    }

    res.json({
        message: 'Cancel all processes completed',
        results: {
            totalCancelled: results.successful.length,
            totalFailed: results.failed.length,
            successfulCancellations: results.successful,
            failedCancellations: results.failed
        }
    });
});

// Get status route with active processes
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

        // Convert activeProcesses Map to a more readable format
        const activeProcessesInfo = Array.from(activeProcesses.entries()).map(([episode, process]) => ({
            episode,
            status: process.status,
            isCancelling: process.cancel
        }));

        res.json({
            downloadingFiles: files,
            downloadFolder: DOWNLOAD_FOLDER,
            logs: logs,
            activeProcesses: activeProcessesInfo,
            totalActiveProcesses: activeProcesses.size
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
