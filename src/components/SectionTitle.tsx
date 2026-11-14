/** HUD section heading:  |•  TITLE  •|  */
export function SectionTitle({ children, as: Tag = 'h2', className = '' }: { children: React.ReactNode; as?: 'h2' | 'h3'; className?: string }) {
  return (
    <Tag className={`flex items-center gap-3 ${className}`}>
      <span aria-hidden className="flex items-center gap-1 text-brass/80">
        <span className="h-3 w-px bg-current" />
        <span className="h-1 w-1 rounded-full bg-current" />
      </span>
      <span className="hud-title text-[13px]">{children}</span>
      <span aria-hidden className="flex items-center gap-1 text-brass/80">
        <span className="h-1 w-1 rounded-full bg-current" />
        <span className="h-3 w-px bg-current" />
      </span>
    </Tag>
  );
}
