import React from 'react'
import { Users, ShieldCheck, BarChart3 } from 'lucide-react'

import { formatBytes } from '../utils/format'

interface StatsGridProps {
  activeCount: number
  totalCount: number
  totalUsage: number
  proxyHealthyCount: number
  proxyTotalCount: number
}

export function StatsGrid({
  activeCount,
  totalCount,
  totalUsage,
  proxyHealthyCount,
  proxyTotalCount
}: StatsGridProps): React.ReactElement {
  // Mock monthly limit for visualization (e.g., 50GB)
  const MONTHLY_LIMIT = 50 * 1024 * 1024 * 1024
  const usagePercentage = Math.min((totalUsage / MONTHLY_LIMIT) * 100, 100)

  // Splitting value and unit for styling
  const formatted = formatBytes(totalUsage)
  const [value, unit] = formatted.split(' ')

  // Proxy Stats
  const healthPercentage =
    proxyTotalCount > 0 ? Math.round((proxyHealthyCount / proxyTotalCount) * 100) : 100
  const isGood = healthPercentage === 100

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
      {/* Card 1: Profiles Summary */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 relative overflow-hidden group hover:border-blue-100 dark:hover:border-blue-900 transition-all duration-200">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors flex-shrink-0">
          <Users size={20} />
        </div>
        <div className="flex flex-col z-10">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Perfis Ativos</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{activeCount}</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">/ {totalCount} total</span>
          </div>
        </div>
        {/* Decorative bg blob */}
        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
      </div>

      {/* Card 2: Proxy Health */}
      <div
        className={`bg-white dark:bg-gray-800 p-4 rounded-xl border shadow-sm flex items-center gap-4 relative overflow-hidden group transition-all duration-200 ${isGood
          ? 'border-gray-100 dark:border-gray-700 hover:border-green-100 dark:hover:border-green-900'
          : 'border-red-100 dark:border-red-900/50 hover:border-red-200 dark:hover:border-red-800'
          }`}
      >
        <div
          className={`p-3 rounded-lg transition-colors flex-shrink-0 ${isGood
            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/30'
            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-900/30'
            }`}
        >
          <ShieldCheck size={20} />
        </div>
        <div className="flex flex-col z-10 w-full">
          <div className="flex justify-between items-center w-full pr-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Proxy Health</p>
            <div className={`w-1.5 h-1.5 rounded-full ${isGood ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{healthPercentage}%</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">{proxyHealthyCount} online</span>
          </div>
        </div>
        {/* Decorative bg blob */}
        <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl transition-colors ${isGood ? 'bg-green-500/5 group-hover:bg-green-500/10' : 'bg-red-500/5 group-hover:bg-red-500/10'}`}></div>
      </div>

      {/* Card 3: Data Usage (Spans 2 cols on mobile/tablet) */}
      <div className="col-span-2 md:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 relative overflow-hidden group hover:border-purple-100 dark:hover:border-purple-900 transition-all duration-200">
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors flex-shrink-0">
          <BarChart3 size={20} />
        </div>
        <div className="flex flex-col z-10 flex-1">
          <div className="flex justify-between items-center">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Dados</p>
            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{usagePercentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{value}</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{unit}</span>
          </div>

          {/* Mini Progress Bar */}
          <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-1 mt-2 overflow-hidden">
            <div
              className="bg-purple-500 h-full rounded-full transition-all duration-1000"
              style={{ width: `${Math.max(usagePercentage, 5)}%` }}
            ></div>
          </div>
        </div>
        {/* Decorative bg blob */}
        <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors"></div>
      </div>
    </div>
  )
}
