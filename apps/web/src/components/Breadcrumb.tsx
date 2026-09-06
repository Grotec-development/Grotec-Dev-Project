import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const DOMAIN = 'https://grotec.in';

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  useEffect(() => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.label,
        ...(item.href ? { item: `${DOMAIN}${item.href}` } : {}),
      })),
    };
    const id = 'breadcrumb-jsonld';
    document.getElementById(id)?.remove();
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = id;
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
    return () => { document.getElementById(id)?.remove(); };
  }, [items]);

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-xs text-slate-500" itemScope itemType="https://schema.org/BreadcrumbList">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1" itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />}
            {item.href && i < items.length - 1 ? (
              <Link to={item.href} className="hover:text-slate-800 transition-colors" itemProp="item">
                <span itemProp="name">{item.label}</span>
              </Link>
            ) : (
              <span className={i === items.length - 1 ? 'font-medium text-slate-700' : ''} itemProp="name">
                {item.label}
              </span>
            )}
            <meta itemProp="position" content={String(i + 1)} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
