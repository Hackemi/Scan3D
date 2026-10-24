import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, r, g, b) {
  // Create raw uncompressed RGBA pixel buffer
  const rowBytes = width * 4 + 1; // +1 for filter type byte (0 = None)
  const raw = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    raw[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      
      // Calculate distance from center for a nice circular gradient
      const cx = width / 2;
      const cy = height / 2;
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.6) {
        // Bright cyan 3D cube highlight in center
        raw[pxOffset] = 6;      // R
        raw[pxOffset + 1] = 182; // G
        raw[pxOffset + 2] = 212; // B
        raw[pxOffset + 3] = 255; // A
      } else if (dist < 0.85) {
        // Dark blue tone
        raw[pxOffset] = 30;
        raw[pxOffset + 1] = 58;
        raw[pxOffset + 2] = 138;
        raw[pxOffset + 3] = 255;
      } else {
        // Deep background
        raw[pxOffset] = r;
        raw[pxOffset + 1] = g;
        raw[pxOffset + 2] = b;
        raw[pxOffset + 3] = 255;
      }
    }
  }

  const deflated = zlib.deflateSync(raw);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// Simple CRC32 for PNG chunks
function crc32(buf) {
  let c = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (c ^ buf[n]);
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate PNG icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, 12, 12, 16));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, 12, 12, 16));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, 12, 12, 16));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, 12, 12, 16));

console.log('PWA icons successfully generated in /public!');
