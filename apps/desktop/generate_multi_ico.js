import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

async function generateMultiResolutionIco() {
  const svgPath = path.join(rootDir, 'public/icons/icon_1.svg');
  const tempDir = path.join(__dirname, 'temp_icons');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngPaths = [];

  for (const size of sizes) {
    const pngPath = path.join(tempDir, `icon_${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    pngPaths.push(pngPath);
  }

  const icoBuffer = await pngToIco(pngPaths);
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const icoPath = path.join(assetsDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`[ICON] Generated multi-resolution Windows ICO (${sizes.join(', ')}px) at ${icoPath} (${icoBuffer.length} bytes)`);

  // Clean up temporary PNGs
  for (const p of pngPaths) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
}

generateMultiResolutionIco().catch((err) => {
  console.error('[ICON ERROR]', err);
});
