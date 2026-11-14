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
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mx-auto max-w-[1600px] px-4 pt-4">
          <div className="flex items-center gap-3 rounded-full border border-verdigris/40 bg-verdigris/[0.08] py-1.5 pl-3 pr-2 text-sm">
            <span className="text-verdigris-light"><Icons.info size={18} /></span>
            <p className="flex-1 text-parchment/90">{t('banner.text')}</p>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 text-slate hover:bg-panel-2 hover:text-parchment" aria-label={t('banner.dismiss')}>
              <Icons.close size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
