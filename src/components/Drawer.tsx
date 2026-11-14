import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Icons } from './icons';

export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[1500] bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog" aria-modal="true" aria-label={title}
            className="stone fixed bottom-0 right-0 top-0 z-[1600] w-full max-w-xl overflow-y-auto !rounded-none !border-y-0 !border-r-0 border-l !border-brass/50 bg-panel p-6 sm:p-8"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="title-caps text-2xl">{title}</h2>
              <button ref={closeRef} onClick={onClose} className="chip flex items-center gap-1.5 !px-3 !py-1 text-xs uppercase tracking-[0.16em]">
                {t('drawer.close')} <Icons.close size={13} />
              </button>
            </div>
            <div className="node-rule mb-6" />
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
