import { useEffect } from 'react';

const BRAND = 'GROTEC FarmerOS';

interface PageHeadProps {
  title: string;
  description?: string;
  jsonLd?: object | object[];
}

/**
 * Updates document.title and meta[name="description"] on mount.
 * Injects a JSON-LD script block when jsonLd is provided.
 * Renders nothing into the DOM.
 */
export function PageHead({ title, description, jsonLd }: PageHeadProps) {
  const fullTitle = title.includes(BRAND) ? title : `${title} — ${BRAND}`;

  useEffect(() => {
    document.title = fullTitle;
    return () => { document.title = BRAND; };
  }, [fullTitle]);

  useEffect(() => {
    if (!description) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    const prev = meta.content;
    meta.content = description;
    return () => { if (meta) meta.content = prev; };
  }, [description]);

  useEffect(() => {
    if (!jsonLd) return;
    const id = 'page-jsonld';
    document.getElementById(id)?.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => { document.getElementById(id)?.remove(); };
  }, [jsonLd]);

  return null;
}