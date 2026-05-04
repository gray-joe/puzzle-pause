import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'br', 'span', 'p', 'ul', 'ol', 'li', 'sup', 'sub'];

export function sanitizePuzzleHtml(html: string): string {
    return sanitizeHtml(html, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: {},
    });
}
