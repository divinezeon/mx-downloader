const { exec } = require('child_process');
const fs = require('fs');
const { Storage } = require('megajs');

const megaStorage = new Storage({
    email: 'your-mega-email@example.com',
    password: 'your-mega-password',
});


// URL array provided directly in the code
const urls = [
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-1-online-9d2013d31d5835bb8400e3b3c5e7bb72",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-2-online-3fbb3c64d2e7daa777d2513ee38c64cd",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-3-online-3615e822cbf307b645b133cbb7136044",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-4-online-b4481dfc65a3e6f7da4df865e5d84c84",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-5-online-677f6c716cf0b2da532695e77ee3fa29",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-6-online-f4d267491aceaff5aa8739d381801c86",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-7-online-cc01b9fde0dde767f1ccef44b299706f",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-8-online-236d32fd2fcde8fab4417ddcf22f4044",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-9-online-b9fadf7e03e4f775df1d2f4de14979ab",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-10-online-3a62fff3dc0098f12045f17f71344f45",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-11-online-2265227a3889746dc2a9bfa8760650c2",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-12-online-90505cc2d81df020b20ffcd022c84ba3",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-13-online-dbba0bf643f93e4bc7cd7c621c78905c",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-14-online-d2f1b292293bfbb2a2857b59dea069c8",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-15-online-8ae297065ec609d5fc99b3d64e55a7d8",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-16-online-7df2f24c3c7e85b5e77d4ca653cb2b21",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-17-online-ff717f394b08d567c428559d121da0e7",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-18-online-ba978c33feabce07e047ad1e8528c9bf",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-19-online-b29f39fd51d1f8133163bc4fc0ac8708",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-20-online-458c6dfa2999870afbbc5f935fc1623f",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-21-online-07278165e81cf2e71222a9f074b7f4af",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-22-online-9acd5f011b6f01c28a6bbb460bb8c259",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-23-online-a44074b1ea94d5c1ea3da8547ab86ff2",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-24-online-588620a8d914c430cbf30801f590de0a",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-25-online-5e3b2587f904e47841c60f899b3ffff2",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-26-online-b829ac7aaa10a19e9849c4e029271a6c",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-27-online-0a92572e83242d08a9715ce70156bb9c",
    "https://www.mxplayer.in/show/watch-my-girlfriend-is-an-alien-hindi-dubbed/season-1/episode-28-online-03949c9dbe365494aa6ab69a9482bc6e"
];






// Folder to temporarily store downloaded videos
const DOWNLOAD_FOLDER = './downloads';

// Ensure the downloads folder exists
if (!fs.existsSync(DOWNLOAD_FOLDER)) {
    fs.mkdirSync(DOWNLOAD_FOLDER);
}

// Function to upload a file to Mega Cloud Storage
async function uploadToMega(filePath, fileName) {
    return new Promise((resolve, reject) => {
        const uploadStream = megaStorage.upload(fileName, fs.createReadStream(filePath));
        uploadStream.on('complete', () => {
            console.log(`Uploaded ${fileName} to Mega Cloud.`);
            // Delete the local file after successful upload
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
    });
}

// Function to download videos sequentially and upload to Mega
async function downloadAndUploadVideos() {
    for (let index = 0; index < urls.length; index++) {
        const url = urls[index];
        const episodeNumber = index + 1; // Episode numbers start from 1
        const fileName = `My Girlfriend is An Alien S01E${String(episodeNumber).padStart(2, '0')} 1080p x264 Hindi.mp4`;
        const filePath = `${DOWNLOAD_FOLDER}/${fileName}`;

        console.log(`Starting download for Episode ${episodeNumber} (${url})...`);

        try {
            // Download the video using yt-dlp
            await new Promise((resolve, reject) => {
                const command = `yt-dlp -o "${filePath}" ${url}`;
                const process = exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error downloading Episode ${episodeNumber}: ${error.message}`);
                        return reject(error.message);
                    }
                    console.log(`Finished downloading Episode ${episodeNumber}: ${stdout}`);
                    resolve();
                });

                // Log progress while downloading
                process.stdout.on('data', (data) => {
                    console.log(`Episode ${episodeNumber} Progress: ${data}`);
                });

                process.stderr.on('data', (data) => {
                    console.error(`Episode ${episodeNumber} Error: ${data}`);
                });
            });

            console.log(`Downloaded Episode ${episodeNumber} successfully to ${filePath}.`);

            // Upload the downloaded file to Mega Cloud
            console.log(`Uploading Episode ${episodeNumber} (${fileName}) to Mega Cloud...`);
            await uploadToMega(filePath, fileName);
        } catch (error) {
            console.error(`Failed to process Episode ${episodeNumber}: ${error}`);
        }
    }

    console.log('All downloads and uploads completed.');
}

// Start the process
downloadAndUploadVideos();

// // Function to download videos sequentially
// async function downloadVideos() {
//     for (let index = 0; index < urls.length; index++) {
//         const url = urls[index];
//         const episodeNumber = index + 1; // Episode numbers start from 1

//         // Generate name dynamically for each episode
//         const name = `My Girlfriend is An Alien S01E${String(episodeNumber).padStart(2, '0')} 1080p x264 Hindi`;

//         console.log(`Starting download for Episode ${episodeNumber} (${url})...`);

//         try {
//             // Execute the yt-dlp command to download the video
//             await new Promise((resolve, reject) => {
//                 const command = `yt-dlp -o "${name}.mp4" ${url}`;
//                 const process = exec(command, (error, stdout, stderr) => {
//                     if (error) {
//                         console.error(`Error downloading Episode ${episodeNumber}: ${error.message}`);
//                         return reject(error.message);
//                     }
//                     console.log(`Finished downloading Episode ${episodeNumber}: ${stdout}`);
//                     resolve();
//                 });

//                 // Log progress while downloading
//                 process.stdout.on('data', (data) => {
//                     console.log(`Episode ${episodeNumber} Progress: ${data}`);
//                 });

//                 process.stderr.on('data', (data) => {
//                     console.error(`Episode ${episodeNumber} Error: ${data}`);
//                 });
//             });

//             console.log(`Episode ${episodeNumber} (${name}.mp4) downloaded successfully.`);
//         } catch (error) {
//             console.error(`Failed to download Episode ${episodeNumber}: ${error}`);
//         }
//     }

//     console.log('All downloads completed.');
// }

// // Start downloading videos
// downloadVideos();
