import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonCardProjetoProps {
  count?: number
}

export const SkeletonCardProjeto: React.FC<SkeletonCardProjetoProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skeleton-prj-${i}`}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-4/5 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
          </div>

          {/* Progresso */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>

          {/* Rodapé */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-3 w-3 rounded-full" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
