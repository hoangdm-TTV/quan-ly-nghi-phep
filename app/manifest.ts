import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tri Thức Việt | Quản lý Nghỉ phép',
    short_name: 'Tri Thức Việt',
    description: 'Cổng quản lý nghỉ phép và đơn ra ngoài.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f1f5f9',
    theme_color: '#005a3c',
    icons: [{ src: '/logo.png', sizes: 'any', type: 'image/png' }],
  };
}
