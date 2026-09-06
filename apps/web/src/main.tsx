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

// Global link interceptor — keeps ALL internal navigation in the same tab.
// External links (target=_blank, mailto:, tel:, downloads) are untouched.
if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (event: MouseEvent) => {
      // Only plain left-click; modifier keys (Cmd/Ctrl/Shift) are intentional
      // "open in new tab" gestures — respect them.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Never intercept: mailto, tel, javascript:, downloads.
      if (
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        anchor.hasAttribute('download')
      ) {
        return;
      }

      // Never intercept explicit external links (full URL to a different host).
      const isExternal =
        (href.startsWith('http://') || href.startsWith('https://')) &&
        !href.startsWith(window.location.origin) &&
        !href.startsWith('http://localhost:5173') &&
        !href.startsWith('http://localhost:3000');
      if (isExternal) return;

      // At this point the link is internal (relative path or same origin).
      // Skip API routes — let the browser handle them as plain HTTP requests.
      let targetPath = href;
      if (href.startsWith('http://') || href.startsWith('https://')) {
        try {
          targetPath = new URL(href).pathname + new URL(href).search + new URL(href).hash;
        } catch {
          return;
        }
      }
      if (targetPath.startsWith('/api')) return;

      // Route via React Router — guaranteed same-tab, no full-page reload.
      event.preventDefault();
      event.stopPropagation();
      void router.navigate(targetPath);
    },
    true, // capture phase — fires before React's synthetic events
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
