import React, { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function Layout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 h-screen font-sans antialiased text-gray-900 dark:text-gray-100 selection:bg-blue-500/30 overflow-hidden transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">{children}</div>
    </div>
  )
}
