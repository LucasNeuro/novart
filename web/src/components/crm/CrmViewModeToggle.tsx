type CrmViewMode = 'table' | 'kanban'

type CrmViewModeToggleProps = {
  mode: CrmViewMode
  onChange: (mode: CrmViewMode) => void
}

export default function CrmViewModeToggle({ mode, onChange }: CrmViewModeToggleProps) {
  return (
    <div className="inline-flex rounded-sm border border-outline-variant bg-white p-1">
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition ${
          mode === 'table' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        Tabela
      </button>
      <button
        type="button"
        onClick={() => onChange('kanban')}
        className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition ${
          mode === 'kanban' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        Kanban
      </button>
    </div>
  )
}

export type { CrmViewMode }
