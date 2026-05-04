export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 border-t-2 border-primary bg-surface px-4 pb-12 pt-10 text-on-surface-variant">
      <div className="landing-wrap flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <p className="m-0 text-[10px] font-bold uppercase tracking-wider">
          © {year} <strong>Obra10+ e Onnze Tecnologia · Todos os direitos reservados</strong> 
        </p>
        <p className="m-0 text-[10px] font-black uppercase tracking-widest text-primary">
          Construindo confiança no ecossistema da obra
        </p>
      </div>
    </footer>
  )
}
