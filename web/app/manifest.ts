import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Puzzle Pause',
        short_name: 'Puzzle Pause',
        description: 'Daily word and logic puzzles',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
            {
                src: '/app_icon_dark.png',
                sizes: '1254x1254',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/app_icon_dark.png',
                sizes: '1254x1254',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/app_icon_light.png',
                sizes: '1254x1254',
                type: 'image/png',
            },
        ],
    };
}
