import { LoaderCircle } from 'lucide-react'
import { createPortal } from 'react-dom'

export function AuthLoading({ message }: { message: string }) {
  return createPortal(
    <div
      role="status"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm"
    >
      <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm font-medium">{message}</p>
    </div>,
    document.body,
  )
}
