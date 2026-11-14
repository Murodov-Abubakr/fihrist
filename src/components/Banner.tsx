import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function Banner() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="mx-auto max-w-[1600px] px-4 pt-3"
        >
          <div className="flex items-center gap-3 rounded border border-brass/30 bg-brass/[0.07] px-4 py-2 text-sm">
            <span aria-hidden className="text-brass">✦</span>
            <p className="flex-1 text-parchment/90">{t('banner.text')}</p>
            <button onClick={() => setOpen(false)} className="text-xs text-slate hover:text-parchment" aria-label={t('banner.dismiss')}>
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
