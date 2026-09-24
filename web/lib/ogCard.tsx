import { ImageResponse } from 'next/og';

// Landscape 1.91:1 — what Slack/Twitter/iMessage unfurls expect.
export const ogSize = { width: 1200, height: 630 };

export function ogCard(title: string, subtitle: string) {
    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: 80,
                background: '#15191e',
                color: '#e0e0e0',
            }}
        >
            <div style={{ fontSize: 36, color: '#4ecca3' }}>&gt; Puzzle Pause</div>
            <div style={{ fontSize: 80, marginTop: 24, lineHeight: 1.1 }}>{title}</div>
            <div style={{ fontSize: 36, color: '#808080', marginTop: 24 }}>{subtitle}</div>
        </div>,
        ogSize
    );
}
