import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Icons } from './icons';

export function Banner() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6">
          <div className="flex items-center gap-3 rounded-full border border-parchment/20 bg-black/40 py-1.5 pl-4 pr-2 text-sm">
            <span className="text-brass-glow"><Icons.info size={17} /></span>
            <p className="flex-1 text-parchment">{t('banner.text')}</p>
            <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-slate hover:bg-white/10 hover:text-parchment" aria-label={t('banner.dismiss')}>
              <Icons.close size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
