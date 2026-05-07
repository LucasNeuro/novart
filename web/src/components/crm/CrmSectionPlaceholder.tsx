type CrmSectionPlaceholderProps = {
  eyebrow: string
  title: string
  description: string
}

export default function CrmSectionPlaceholder({
  eyebrow,
  title,
  description,
}: CrmSectionPlaceholderProps) {
  return (
    <div className="mx-auto max-w-6xl">
      <section className="border-2 border-primary bg-white p-6 md:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-primary md:text-3xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm font-medium text-on-surface-variant">{description}</p>
      </section>
    </div>
  )
}
