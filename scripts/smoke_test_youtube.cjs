const cp = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ytDlpPath = path.resolve(__dirname, '../resources/bin/yt-dlp.exe');
const ffmpegPath = path.resolve(__dirname, '../resources/bin/ffmpeg.exe');

console.log('=== SMOKE TEST: YouTube Engine v5.2 ===');
console.log('yt-dlp binary:', ytDlpPath, 'exists:', fs.existsSync(ytDlpPath));
console.log('ffmpeg binary:', ffmpegPath, 'exists:', fs.existsSync(ffmpegPath));

if (!fs.existsSync(ytDlpPath)) {
  console.error('FAIL: yt-dlp binary missing!');
  process.exit(1);
}

// 1. Version check
const ytVersion = cp.execFileSync(ytDlpPath, ['--version'], { encoding: 'utf8' }).trim();
console.log('yt-dlp version:', ytVersion);

if (fs.existsSync(ffmpegPath)) {
  const ffVersion = cp.execFileSync(ffmpegPath, ['-version'], { encoding: 'utf8' }).split('\n')[0];
  console.log('ffmpeg version:', ffVersion.trim());
}

// 2. Search for "Teri Yaadon Mein The Killer KK Shreya Ghoshal"
console.log('\n--- Step 1: Searching for "Teri Yaadon Mein The Killer KK Shreya Ghoshal" ---');
const searchQuery = 'Teri Yaadon Mein The Killer KK Shreya Ghoshal';
const searchArgs = [
  `ytsearch1:${searchQuery}`,
  '--flat-playlist',
  '-J'
];

const searchOutput = cp.execFileSync(ytDlpPath, searchArgs, {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024
});

const searchResult = JSON.parse(searchOutput);
const first = searchResult.entries?.[0];
if (!first) {
  console.error('FAIL: No search results returned');
  process.exit(1);
}

console.log('Found video:');
console.log('  ID:', first.id);
console.log('  Title:', first.title);
console.log('  Channel:', first.channel || first.uploader);
console.log('  Duration:', first.duration, 'sec');
console.log('  Views:', first.view_count);
console.log('  URL:', first.url);

// 3. Format extraction for the first result with client chain
console.log(`\n--- Step 2: Extracting full adaptive format ladder for video ID ${first.id} ---`);

const clientChains = [
  ['--extractor-args', 'youtube:player_client=all'],
  ['--extractor-args', 'youtube:player_client=default,tv,web_safari,mweb'],
  ['--extractor-args', 'youtube:player_client=tv,android']
];

let rawFormatData = null;
for (const cArgs of clientChains) {
  try {
    const formatOutput = cp.execFileSync(ytDlpPath, [first.id, '-J', ...cArgs], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
    const parsed = JSON.parse(formatOutput);
    const heights = new Set((parsed.formats || []).filter((f) => f.height > 0).map((f) => f.height));
    if (heights.size >= 4) {
      rawFormatData = parsed;
      break;
    }
    if (!rawFormatData) rawFormatData = parsed;
  } catch (err) {
    // try next
  }
}

if (!rawFormatData) {
  console.error('FAIL: Could not extract formats');
  process.exit(1);
}

// Transpile youtubeFormats on the fly for pure mapping verification
const ts = require('typescript');
const code = fs.readFileSync(path.resolve(__dirname, '../src/main/modules/youtubeFormats.ts'), 'utf8');
const transpiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', transpiled)(m, m.exports);
const mapped = m.exports.mapAndGroupFormats(rawFormatData);

console.log(`Extracted title: ${mapped.title}`);
console.log(`Total raw formats in manifest: ${rawFormatData.formats?.length || 0}`);

console.log('\nAdaptive Video Ladder (Grouped by standard heights):');
mapped.video.forEach((v) => {
  const kind = v.hasAudio ? 'progressive (video+audio)' : 'DASH (video-only)';
  console.log(
    `  ${String(v.height + 'p').padEnd(6)} | format ${v.formatId.padEnd(5)} | ${kind.padEnd(28)} | ext: ${v.ext.padEnd(5)} | fps: ${String(v.fps).padEnd(3)} | vbr: ${String(v.vbrKbps + 'k').padEnd(6)} | size: ${(v.sizeBytes / 1024 / 1024).toFixed(2)} MB`
  );
});

console.log('\nAudio Streams:');
mapped.audio.forEach((a) => {
  console.log(
    `  format ${a.formatId.padEnd(5)} | ext: ${a.ext.padEnd(5)} | abr: ${String(a.abrKbps + 'k').padEnd(6)} | size: ${(a.sizeBytes / 1024 / 1024).toFixed(2)} MB`
  );
});

// 4. Test proxy-mux for a DASH height (e.g. 1080p or 720p)
console.log('\n--- Step 3: Verifying proxy-mux stream for DASH format ---');
async function testProxyMux() {
  const videoDash = rawFormatData.formats.find(
    (f) => f.height === 1080 && f.url && f.vcodec !== 'none' && f.acodec === 'none' && f.ext === 'mp4'
  ) || rawFormatData.formats.find(
    (f) => f.height === 720 && f.url && f.vcodec !== 'none' && f.acodec === 'none' && f.ext === 'mp4'
  );

  const audioDash = rawFormatData.formats.find((f) => f.format_id === '140' && f.url) ||
                    rawFormatData.formats.find((f) => (f.vcodec === 'none' || !f.vcodec) && f.acodec && f.acodec !== 'none' && f.url);

  if (!videoDash || !audioDash) {
    throw new Error('DASH video/audio formats not found for proxy test');
  }

  console.log(`Proxy source video: format ${videoDash.format_id} (${videoDash.height}p, ${videoDash.vcodec})`);
  console.log(`Proxy source audio: format ${audioDash.format_id} (${audioDash.acodec}, ${audioDash.abr || audioDash.tbr}k)`);

  let server;
  let port = 0;

  await new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'none',
        'Transfer-Encoding': 'chunked',
        'Connection': 'keep-alive'
      });

      const ff = cp.spawn(
        ffmpegPath,
        [
          '-reconnect', '1',
          '-reconnect_streamed', '1',
          '-reconnect_delay_max', '5',
          '-i', videoDash.url,
          '-reconnect', '1',
          '-reconnect_streamed', '1',
          '-reconnect_delay_max', '5',
          '-i', audioDash.url,
          '-c', 'copy',
          '-f', 'mp4',
          '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
          'pipe:1'
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
      );

      ff.stdout.pipe(res);
      req.on('close', () => { try { ff.kill(); } catch {} });
    });

    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
    server.on('error', reject);
  });

  const samplePath = path.resolve(__dirname, 'smoke_proxy_sample.mp4');
  console.log(`Fetching 5s of proxy stream from http://127.0.0.1:${port}/stream...`);

  await new Promise((resolve, reject) => {
    const ffCapture = cp.spawn(
      ffmpegPath,
      ['-y', '-t', '5', '-i', `http://127.0.0.1:${port}/stream`, '-c', 'copy', samplePath],
      { windowsHide: true }
    );
    ffCapture.on('close', (code) => {
      if (code === 0 && fs.existsSync(samplePath) && fs.statSync(samplePath).size > 0) {
        console.log(`Proxy stream captured: ${fs.statSync(samplePath).size} bytes`);
        resolve();
      } else {
        reject(new Error(`Failed to capture proxy stream, code: ${code}`));
      }
    });
    ffCapture.on('error', reject);
  });

  // Inspect sample with ffmpeg probe
  let probeOut = '';
  try {
    cp.execFileSync(ffmpegPath, ['-i', samplePath], { encoding: 'utf8' });
  } catch (err) {
    probeOut = err.stderr ? err.stderr.toString() : err.message;
  }

  console.log('\nffprobe / ffmpeg stream inspection:');
  const streamLines = probeOut
    .split(/[\r\n]+/)
    .filter((l) => l.includes('Stream #') || l.includes('Duration:'));
  streamLines.forEach((l) => console.log(' ', l.trim()));

  // Cleanup
  server.close();
  if (fs.existsSync(samplePath)) fs.unlinkSync(samplePath);

  console.log('\n=== SMOKE TEST COMPLETED SUCCESSFULLY ===');
}

testProxyMux().catch((err) => {
  console.error('Proxy mux verification failed:', err);
  process.exit(1);
});
