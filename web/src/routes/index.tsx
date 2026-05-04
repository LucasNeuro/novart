import { createFileRoute } from '@tanstack/react-router'
import LandingHome from '../components/LandingHome'

/** Entrada pública: landing institucional para visitantes deslogados; “Entrar” leva a `/login`. */
export const Route = createFileRoute('/')({
  component: LandingHome,
})
