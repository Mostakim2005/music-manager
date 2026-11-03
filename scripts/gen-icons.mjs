import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const svgPath = path.join(rootDir, 'src/renderer/assets/logo.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  console.log('Generating PNG icons from logo.svg...');

  // 512x512 base PNG
  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  // 192x192
  const png192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
  // 16x16
  const png16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
  // 32x32
  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  // 48x48
  const png48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
  // 256x256
  const png256 = await sharp(svgBuffer).resize(256, 256).png().toBuffer();

  const resourcesDir = path.join(rootDir, 'resources');
  fs.writeFileSync(path.join(resourcesDir, 'icon.png'), png512);
  fs.writeFileSync(path.join(resourcesDir, 'icon-512.png'), png512);
  fs.writeFileSync(path.join(resourcesDir, 'icon-512-maskable.png'), png512);
  fs.writeFileSync(path.join(resourcesDir, 'icon-192.png'), png192);
  fs.writeFileSync(path.join(resourcesDir, 'icon_16x16.png'), png16);

  // Also update src/renderer/assets icon.png and logo.png so UI avatar / logo shows double M
  const assetsDir = path.join(rootDir, 'src/renderer/assets');
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), png512);
  fs.writeFileSync(path.join(assetsDir, 'logo.png'), png512);

  console.log('Generating ICO files...');
  const icoMulti = await pngToIco([png16, png32, png48, png256]);
  fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), icoMulti);

  const faviconIco = await pngToIco([png16, png32, png48]);
  fs.writeFileSync(path.join(resourcesDir, 'favicon.ico'), faviconIco);

  console.log('Successfully generated all icons!');
}

generate().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
