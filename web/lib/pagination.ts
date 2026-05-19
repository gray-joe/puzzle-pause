export type PageSearchParams = Record<string, string | string[] | undefined>;

export function single(v: string | string[] | undefined) {
    return Array.isArray(v) ? v[0] : v;
}

export function pageFromSearchParams(params: PageSearchParams) {
    const parsed = Number(single(params.page) ?? '1');
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function hrefWithPage(path: string, params: PageSearchParams, page: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (key === 'page' || value === undefined) continue;
        if (Array.isArray(value)) {
            value.forEach((item) => query.append(key, item));
        } else {
            query.set(key, value);
        }
    }
    if (page > 1) query.set('page', String(page));
    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
}
