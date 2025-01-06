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
const PORT = process.env.PORT || 3000;
const EMAIL = process.env.MEGA_EMAIL;
const PASSWORD = process.env.MEGA_PASSWORD;

// Ensure downloads folder exists
if (!fs.existsSync(DOWNLOAD_FOLDER)) {
    fs.mkdirSync(DOWNLOAD_FOLDER);
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
async function uploadToMega(filePath, fileName) {
    if (!megaStorage) {
        throw new Error('Mega storage not initialized');
    }

    return new Promise((resolve, reject) => {
        try {
            const stats = fs.statSync(filePath);
            const fileStream = fs.createReadStream(filePath);

            const uploadStream = megaStorage.upload({
                name: fileName,
                size: stats.size
            });

            uploadStream.on('complete', () => {
                console.log(`Uploaded ${fileName} to Mega Cloud.`);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(`Failed to delete local file ${filePath}: ${err.message}`);
                    } else {
                        console.log(`Deleted local file: ${filePath}`);
                    }
                });
                resolve();
            });

            uploadStream.on('error', (err) => {
                console.error(`Failed to upload ${fileName} to Mega Cloud: ${err.message}`);
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

    try {
        // Download video using yt-dlp-exec
        console.log(`Starting download for episode ${episodeNumber}`);

        await ytdlp(url, {
            output: filePath,
            verbose: true,
            noCheckCertificates: true,
            progress: true
        });

        console.log(`Download completed for episode ${episodeNumber}`);

        // Upload to Mega
        await uploadToMega(filePath, fileName);
        return { success: true, message: `Successfully processed episode ${episodeNumber}` };
    } catch (error) {
        console.error(`Error processing episode ${episodeNumber}:`, error);
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
        res.json({
            downloadingFiles: files,
            downloadFolder: DOWNLOAD_FOLDER
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
