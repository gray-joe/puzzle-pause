'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, AdminAttempt } from '@/lib/api';

function toDatetimeLocal(dt: string | null): string {
    if (!dt) return '';
    // Backend returns ISO string; datetime-local input expects "YYYY-MM-DDTHH:MM"
    return dt.slice(0, 16);
}

interface Props {
    attempt: AdminAttempt;
}

export default function AttemptForm({ attempt }: Props) {
    const router = useRouter();

    const [form, setForm] = useState({
        solved: attempt.solved,
        score: attempt.score?.toString() ?? '',
        incorrect_guesses: attempt.incorrect_guesses.toString(),
        hint_used: attempt.hint_used,
        opened_at: toDatetimeLocal(attempt.opened_at),
        completed_at: toDatetimeLocal(attempt.completed_at),
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    function set(field: string, value: string | boolean) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.admin.updateAttempt(attempt.id, {
                solved: form.solved,
                score: form.score === '' ? null : Number(form.score),
                incorrect_guesses: Number(form.incorrect_guesses),
                hint_used: form.hint_used,
                opened_at: form.opened_at ? form.opened_at + ':00' : null,
                completed_at: form.completed_at ? form.completed_at + ':00' : null,
            });
            router.push('/admin/attempts');
            router.refresh();
        } catch (err: any) {
            setError(err.message ?? 'Failed to save');
        } finally {
            setLoading(false);
        }
    }

    const fieldStyle = { marginBottom: 12 };
    const labelStyle = { color: 'var(--muted)', display: 'block', marginBottom: 4 };

    return (
        <form onSubmit={handleSubmit}>
            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <span className="gt">&gt;</span> Solved
                </label>
                <select
                    value={form.solved ? '1' : '0'}
                    onChange={(e) => set('solved', e.target.value === '1')}
                >
                    <option value="1">yes</option>
                    <option value="0">no</option>
                </select>
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <span className="gt">&gt;</span> Score
                </label>
                <input
                    type="number"
                    value={form.score}
                    onChange={(e) => set('score', e.target.value)}
                    placeholder="—"
                />
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <span className="gt">&gt;</span> Wrong guesses
                </label>
                <input
                    type="number"
                    min={0}
                    value={form.incorrect_guesses}
                    onChange={(e) => set('incorrect_guesses', e.target.value)}
                />
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <span className="gt">&gt;</span> Hint used
                </label>
                <select
                    value={form.hint_used ? '1' : '0'}
                    onChange={(e) => set('hint_used', e.target.value === '1')}
                >
                    <option value="0">no</option>
                    <option value="1">yes</option>
                </select>
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <span className="gt">&gt;</span> Opened at
                </label>
                <input
                    type="datetime-local"
                    value={form.opened_at}
                    onChange={(e) => set('opened_at', e.target.value)}
                />
            </div>

            <div style={fieldStyle}>
                <label style={labelStyle}>
                    <span className="gt">&gt;</span> Completed at
                </label>
                <input
                    type="datetime-local"
                    value={form.completed_at}
                    onChange={(e) => set('completed_at', e.target.value)}
                />
            </div>

            {error && (
                <div className="error" style={{ marginBottom: 12 }}>
                    {error}
                </div>
            )}

            <button
                type="submit"
                className="action-btn"
                disabled={loading}
                style={{ marginTop: 8 }}
            >
                <span className="gt">&gt;</span>
                {loading ? 'Saving...' : 'Save Changes'}
            </button>
        </form>
    );
}
