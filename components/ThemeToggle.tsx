'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="rounded-lg p-2 hover:bg-muted transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <FontAwesomeIcon icon={faSun} className="h-5 w-5 text-yellow-500" />
      ) : (
        <FontAwesomeIcon icon={faMoon} className="h-5 w-5 text-slate-700" />
      )}
    </button>
  );
}
