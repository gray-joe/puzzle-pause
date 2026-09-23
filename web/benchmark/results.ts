import fs from 'fs';
import path from 'path';

export interface BenchmarkResult {
    model: string;
    puzzleType: string;
    solved: boolean;
    attempts: number;
    hintUsed: boolean;
    modelAnswer: string;
    score: string | null;
    /** Score carried over from an earlier run rather than played fresh in this one. */
    alreadyPlayed?: boolean;
}

const RESULTS_FILE = path.resolve(__dirname, 'results/latest.jsonl');

export function recordResult(result: BenchmarkResult) {
    fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
    fs.appendFileSync(RESULTS_FILE, JSON.stringify(result) + '\n');
}
