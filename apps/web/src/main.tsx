import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './auth/AuthContext';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

// Global link interceptor: Prevent any internal link from opening in a new tab/window
if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (event: MouseEvent) => {
      // Allow user modifier clicks (Cmd/Ctrl click to explicitly open in new tab)
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Ignore mailto, tel, javascript, downloads
      if (
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        anchor.hasAttribute('download')
      ) {
        return;
      }

      const isRelative = href.startsWith('/') || href.startsWith('#');
      const isSameHost =
        (href.startsWith('http://') || href.startsWith('https://')) &&
        (href.startsWith(window.location.origin) || href.startsWith('http://localhost:5173'));

      if (isRelative || isSameHost) {
        if (anchor.target && anchor.target !== '_self') {
          anchor.target = '_self';
        }
        anchor.removeAttribute('target');

        let targetPath = href;
        if (isSameHost) {
          try {
            const url = new URL(href);
            targetPath = url.pathname + url.search + url.hash;
          } catch {
            targetPath = href;
          }
        }

        if (!targetPath.startsWith('/api')) {
          event.preventDefault();
          event.stopPropagation();
          void router.navigate(targetPath);
        }
      }
    },
    true, // Capture phase
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
