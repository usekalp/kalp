import type { ReactNode } from 'react'
import './ladle.css'

export const Provider = ({ children }: { children: ReactNode }) => {
  return <div className="dark">{children}</div>
}
