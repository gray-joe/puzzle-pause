import { readFileSync } from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import PageShell from '@/components/ui/PageShell';

export const dynamic = 'force-static';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'Privacy policy for Puzzle Pause.',
};

const PRIVACY_PATH = path.join(process.cwd(), '..', 'docs', 'privacy.md');

function renderInline(text: string): ReactNode[] {
    return text.split(/(`[^`]+`)/g).map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={index}>{part.slice(1, -1)}</code>;
        }

        return part;
    });
}

function renderMarkdown(markdown: string): ReactNode[] {
    const blocks: ReactNode[] = [];
    let listItems: string[] = [];
    let paragraphLines: string[] = [];

    const flushList = () => {
        if (listItems.length === 0) return;

        blocks.push(
            <ul key={`ul-${blocks.length}`}>
                {listItems.map((item, index) => (
                    <li key={index}>{renderInline(item)}</li>
                ))}
            </ul>
        );
        listItems = [];
    };

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;

        blocks.push(<p key={`p-${blocks.length}`}>{renderInline(paragraphLines.join(' '))}</p>);
        paragraphLines = [];
    };

    for (const line of markdown.split(/\r?\n/)) {
        if (line.trim() === '') {
            flushParagraph();
            flushList();
            continue;
        }

        if (line.startsWith('# ')) {
            flushParagraph();
            flushList();
            blocks.push(<h1 key={`h1-${blocks.length}`}>{renderInline(line.slice(2))}</h1>);
            continue;
        }

        if (line.startsWith('## ')) {
            flushParagraph();
            flushList();
            blocks.push(<h2 key={`h2-${blocks.length}`}>{renderInline(line.slice(3))}</h2>);
            continue;
        }

        if (line.startsWith('- ')) {
            flushParagraph();
            listItems.push(line.slice(2));
            continue;
        }

        paragraphLines.push(line);
    }

    flushParagraph();
    flushList();

    return blocks;
}

export default function PrivacyPage() {
    const privacyMarkdown = readFileSync(PRIVACY_PATH, 'utf8');

    return (
        <PageShell title="Privacy">
            <main className="privacy-content">{renderMarkdown(privacyMarkdown)}</main>
        </PageShell>
    );
}
