/** Section heading: grey tracked caps followed by a hairline with dot ends —  TITLE  •────────• */
export function SectionTitle({ children, as: Tag = 'h2', className = '' }: { children: React.ReactNode; as?: 'h2' | 'h3'; className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <Tag className="shrink-0 font-display text-[13px] font-medium uppercase tracking-[0.24em] text-slate">{children}</Tag>
      <div aria-hidden className="node-rule flex-1" />
    </div>
  );
}
