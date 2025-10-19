import type { FC } from 'react';

export type NavKey = 'children' | 'templates' | 'today' | 'history';

const NAV_ITEMS: Array<{ key: NavKey; label: string; enabled: boolean }> = [
  { key: 'children', label: 'Children', enabled: true },
  { key: 'templates', label: 'Templates', enabled: true },
  { key: 'today', label: 'Today', enabled: true },
  { key: 'history', label: 'History', enabled: false }
];

type SidebarNavProps = {
  activeKey: NavKey;
  onSelect: (key: NavKey) => void;
};

export const SidebarNav: FC<SidebarNavProps> = ({ activeKey, onSelect }) => (
  <nav className="flex flex-col gap-2">
    {NAV_ITEMS.map((item) => {
      const isActive = activeKey === item.key;
      const baseClasses =
        'rounded-lg px-4 py-3 text-left text-lg font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400';
      const enabledClasses = isActive
        ? 'bg-emerald-500 text-slate-900 shadow'
        : 'bg-slate-800 text-slate-100 hover:bg-slate-700';
      const disabledClasses = 'cursor-not-allowed bg-slate-900 text-slate-600';

      return (
        <button
          key={item.key}
          type="button"
          disabled={!item.enabled}
          onClick={() => item.enabled && onSelect(item.key)}
          className={`${baseClasses} ${item.enabled ? enabledClasses : disabledClasses}`}
        >
          {item.label}
          {!item.enabled && <span className="ml-2 text-xs uppercase">(coming soon)</span>}
        </button>
      );
    })}
  </nav>
);

export const getInitialNavKey = (): NavKey => 'children';
