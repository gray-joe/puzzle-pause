import Link from 'next/link';
import { hrefWithPage, PageSearchParams } from '@/lib/pagination';

type Props = {
    basePath: string;
    params: PageSearchParams;
    page: number;
    hasNextPage: boolean;
};

export default function PaginationControls({ basePath, params, page, hasNextPage }: Props) {
    if (page <= 1 && !hasNextPage) return null;

    return (
        <div
            style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'space-between',
                marginTop: 24,
            }}
        >
            {page > 1 ? (
                <Link
                    href={hrefWithPage(basePath, params, page - 1)}
                    className="action-btn"
                    style={{ width: 'auto' }}
                >
                    <span className="gt">&gt;</span>Previous
                </Link>
            ) : (
                <span />
            )}
            {hasNextPage && (
                <Link
                    href={hrefWithPage(basePath, params, page + 1)}
                    className="action-btn"
                    style={{ width: 'auto' }}
                >
                    <span className="gt">&gt;</span>Next
                </Link>
            )}
        </div>
    );
}
