import React from 'react';
import { useTranslation } from '../i18n';

export const LanguageToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { lang, setLang } = useTranslation();

  return (
    <div
      className={`neu-inset p-1 flex items-center gap-1 rounded-2xl shrink-0 ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
          lang === 'en'
            ? 'bg-gradient-to-r from-[#683DD0] to-[#4C23A8] text-white shadow-sm'
            : 'text-[#7A7396] hover:text-[#241A3F]'
        }`}
        aria-pressed={lang === 'en'}
        title="English"
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => setLang('bn')}
        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer font-['Inter'] ${
          lang === 'bn'
            ? 'bg-gradient-to-r from-[#683DD0] to-[#4C23A8] text-white shadow-sm'
            : 'text-[#7A7396] hover:text-[#241A3F]'
        }`}
        aria-pressed={lang === 'bn'}
        title="বাংলা"
      >
        বাংলা
      </button>
    </div>
  );
};

