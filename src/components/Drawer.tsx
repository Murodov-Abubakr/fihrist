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
          <motion.div className="fixed inset-0 z-[1500] bg-ink/75 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog" aria-modal="true" aria-label={title}
            className="fixed bottom-0 right-0 top-0 z-[1600] w-full max-w-xl overflow-y-auto border-l border-brass/25 bg-panel p-6"
            style={{ boxShadow: '-30px 0 60px -30px rgba(0,0,0,.9)' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="hud-title text-base text-brass">{title}</h2>
              <button ref={closeRef} onClick={onClose} className="flex items-center gap-1.5 rounded-full border border-slate/25 px-3 py-1 text-xs uppercase tracking-[0.14em] text-slate hover:border-brass/50 hover:text-parchment">
                {t('drawer.close')} <Icons.close size={13} />
              </button>
            </div>
            <div className="node-rule mb-5" />
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
