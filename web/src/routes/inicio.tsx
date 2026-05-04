import { Navigate, createFileRoute } from '@tanstack/react-router'

/** Compatibilidade: URL antiga redireciona para a landing canónica em `/`. */
export const Route = createFileRoute('/inicio')({
  component: InicioRedirect,
})

function InicioRedirect() {
  return <Navigate to="/" replace />
}
