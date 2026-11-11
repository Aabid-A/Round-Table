import { readGameLog } from '../log/writer.js';
import { renderTranscript } from '../log/transcript.js';

const path = process.argv[2];
if (!path) {
  console.error('usage: npm run transcript -- <log path>');
  process.exit(1);
}
try {
  process.stdout.write(renderTranscript(readGameLog(path)));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
