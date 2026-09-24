import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const resultsFile = path.join(dir, 'results/latest.jsonl');

if (!fs.existsSync(resultsFile)) {
    console.log('No benchmark results found at', resultsFile);
    process.exit(0);
}

const lines = fs
    .readFileSync(resultsFile, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

// A retried test appends a row per attempt; keep only the last one per model+type so a test
// that passed on retry doesn't render as its earlier failure, and counts stay out of N/total.
const results = [...new Map(lines.map((r) => [`${r.model}\u0000${r.puzzleType}`, r])).values()];

const models = [...new Set(results.map((r) => r.model))];
const puzzleTypes = [...new Set(results.map((r) => r.puzzleType))];

const cell = (model, puzzleType) => {
    const r = results.find((x) => x.model === model && x.puzzleType === puzzleType);
    if (!r) return '-';
    // Standing score from an earlier run — the bot accounts persist, so it wasn't replayed.
    if (r.alreadyPlayed) return r.solved ? `✅ ${r.score} (prior)` : '❌ (prior)';
    const detail = [
        r.guesses > 1 ? `${r.guesses} guesses` : null,
        r.rejected ? `${r.rejected} rejected` : null,
        r.hintUsed ? 'hint' : null,
    ].filter(Boolean);

    if (!r.solved) return `❌${detail.length ? ` (${detail.join(' + ')})` : ''}`;
    const cost = detail.join(' + ');
    return cost ? `✅ ${r.score} (${cost})` : `✅ ${r.score}`;
};

const header = `| Model | ${puzzleTypes.join(' | ')} | Solved |`;
const divider = `|---|${puzzleTypes.map(() => '---').join('|')}|---|`;
const rows = models.map((model) => {
    const cells = puzzleTypes.map((t) => cell(model, t));
    const solvedCount = results.filter((r) => r.model === model && r.solved).length;
    return `| ${model} | ${cells.join(' | ')} | ${solvedCount}/${puzzleTypes.length} |`;
});

console.log([header, divider, ...rows].join('\n'));
