const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const BUFFER_ROOT = process.env.BUFFER_PATH || '/dev/shm/billiard_buffers';
const CLIPS_OUTPUT_DIR = path.join(__dirname, '../public/clips');

if (!fs.existsSync(CLIPS_OUTPUT_DIR)) {
  fs.mkdirSync(CLIPS_OUTPUT_DIR, { recursive: true });
}

class HighlightClipper {
  /**
   * Mengambil rekaman 30 detik terakhir dari buffer RAM-disk
   * @param {string|number} tableId 
   * @returns {Promise<string>} File download URL
   */
  async extractLast30Seconds(tableId) {
    const tableBufferDir = path.join(BUFFER_ROOT, `table_${tableId}`);
    const timestamp = Math.floor(Date.now() / 1000);
    const outputFilename = `clip_table${tableId}_${timestamp}.mp4`;
    const outputPath = path.join(CLIPS_OUTPUT_DIR, outputFilename);

    // Jika direktori buffer RAM-disk ada dan terdapat file segment
    if (fs.existsSync(tableBufferDir)) {
      const files = fs.readdirSync(tableBufferDir)
        .filter(f => f.endsWith('.ts') || f.endsWith('.mp4'))
        .sort((a, b) => {
          return fs.statSync(path.join(tableBufferDir, a)).mtimeMs - 
                 fs.statSync(path.join(tableBufferDir, b)).mtimeMs;
        });

      // Ambil 10 segmen terakhir (jika segmen per 3 detik = 30 detik)
      const lastSegments = files.slice(-10);

      if (lastSegments.length > 0) {
        const concatListPath = path.join(tableBufferDir, `concat_${timestamp}.txt`);
        const fileContent = lastSegments.map(f => `file '${path.join(tableBufferDir, f)}'`).join('\n');
        fs.writeFileSync(concatListPath, fileContent);

        return new Promise((resolve, reject) => {
          // Stream copy (-c copy) untuk kecepatan instan < 500ms tanpa re-encoding CPU
          const cmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy -movflags +faststart "${outputPath}"`;
          exec(cmd, (err) => {
            try { fs.unlinkSync(concatListPath); } catch (e) {}
            if (err) {
              return reject(err);
            }
            resolve({
              downloadUrl: `/clips/${outputFilename}`,
              filename: outputFilename,
              fileSize: fs.statSync(outputPath).size
            });
          });
        });
      }
    }

    // Fallback: Mock clip generation untuk keperluan demonstrasi/testing tanpa hardware live camera
    return new Promise((resolve) => {
      const mockCmd = `ffmpeg -y -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 -c:v libx264 -pix_fmt yuv420p "${outputPath}"`;
      exec(mockCmd, () => {
        resolve({
          downloadUrl: `/clips/${outputFilename}`,
          filename: outputFilename,
          mock: true
        });
      });
    });
  }
}

module.exports = new HighlightClipper();
