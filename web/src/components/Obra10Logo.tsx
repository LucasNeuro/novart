/**
 * Marca Obra10+ — gráfico em barras (contorno) + Inter black; alinhamento por `em` ao tamanho do texto.
 */
type Obra10LogoProps = {
  className?: string
  /** Altura mínima da linha (Tailwind), ex. h-8, h-9 */
  heightClass?: string
  /** Fundo escuro: “OBRA10” em branco; símbolo e “+” em verde */
  onDark?: boolean
  /** Só o símbolo (ex. sidebar CRM fechada) */
  markOnly?: boolean
}

/** Três barras vazias + base — peso do traço próximo do Inter 900. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="2"
        y="10"
        width="9"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <rect
        x="15.5"
        y="2"
        width="9"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <rect
        x="29"
        y="7"
        width="9"
        height="17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M1 24.5h38"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Obra10Logo({
  className = '',
  heightClass = 'h-9',
  onDark = false,
  markOnly = false,
}: Obra10LogoProps) {
  const wordClass = onDark ? 'text-white' : 'text-primary'

  if (markOnly) {
    return (
      <span
        role="img"
        aria-label="Obra10+"
        className={`inline-flex items-center justify-center ${heightClass} ${className}`}
      >
        <LogoMark className="h-[70%] max-h-9 min-h-5 w-auto text-tertiary" />
      </span>
    )
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-[0.4em] font-sans text-[0.9375rem] font-black leading-none tracking-[-0.045em] antialiased sm:text-[1.0625rem] ${heightClass} ${className}`}
    >
      <LogoMark className="h-[0.92em] w-auto shrink-0 text-tertiary" />
      <span className={`min-w-0 ${wordClass}`}>
        OBRA10<span className="text-tertiary">+</span>
      </span>
    </span>
  )
}
