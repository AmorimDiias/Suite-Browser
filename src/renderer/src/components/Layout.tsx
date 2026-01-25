import React, { ReactNode } from 'react'

export function Layout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <div className="flex bg-gray-950 min-h-screen text-gray-100 font-sans selection:bg-blue-500/30">
      <div className="flex-1 flex flex-col h-screen overflow-hidden">{children}</div>
    </div>
  )
}
