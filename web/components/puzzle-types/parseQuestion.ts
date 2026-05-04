export function parseQuestion<T>(question: string): T | null {
    try {
        return JSON.parse(question) as T;
    } catch {
        return null;
    }
}
