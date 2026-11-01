import React, { useContext, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthContext } from '@/context/AuthContext';
import api from '@/services/api';
import { SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY } from '@/i18n/languageConfig';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher({ className, compact = false, variant = 'ghost' }) {
  const { i18n } = useTranslation();
  const { user, updateUser } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLangCode = i18n.language?.split('-')[0] || 'en';
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleSelectLanguage = async (code) => {
    setOpen(false);
    if (code === currentLangCode) return;

    // 1. Immediately switch language via i18next without reload
    await i18n.changeLanguage(code);

    // 2. Persist in localStorage
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
      localStorage.setItem('i18nextLng', code);
    } catch (_) {}

    // 3. If authenticated, persist to user account
    if (user?.id || user?._id) {
      try {
        await api.put('/users/language', { language: code });
        if (updateUser) {
          updateUser({ ...user, preferredLanguage: code });
        }
      } catch (err) {
        // Non-blocking fallback
        console.warn('Could not persist language to user account:', err?.message);
      }
    }
  };

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <Button
        type="button"
        variant={variant}
        size={compact ? 'icon' : 'sm'}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-colors text-xs font-medium',
          compact ? 'size-9 p-0' : 'h-9 px-2.5',
          open && 'bg-accent text-accent-foreground'
        )}
        aria-label="Select language"
        title="Select language / भाषा निवडा / भाषा चुनें"
      >
        <Globe className="size-4 shrink-0" aria-hidden />
        {!compact && <span className="font-semibold">{currentLang.nativeName}</span>}
      </Button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-1.5 z-50 w-36 rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in-80 zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Language / भाषा
          </div>
          <div className="space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === currentLangCode;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer',
                    isSelected
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xs">{lang.nativeName}</span>
                    <span className="text-[10px] text-muted-foreground">({lang.name})</span>
                  </span>
                  {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

