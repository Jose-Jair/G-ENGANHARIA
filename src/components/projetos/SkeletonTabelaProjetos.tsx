import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonTabelaProjetosProps {
  rows?: number
}

export const SkeletonTabelaProjetos: React.FC<SkeletonTabelaProjetosProps> = ({ rows = 8 }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      <div className="border-b border-slate-200 bg-slate-50/75 px-4 py-3">
        <div className="grid grid-cols-12 gap-2 items-center">
          <Skeleton className="h-4 w-20 col-span-2" />
          <Skeleton className="h-4 w-36 col-span-3" />
          <Skeleton className="h-4 w-16 col-span-1 hidden md:block" />
          <Skeleton className="h-4 w-20 col-span-2 text-right" />
          <Skeleton className="h-4 w-20 col-span-2 hidden sm:block" />
          <Skeleton className="h-4 w-16 col-span-1 hidden lg:block" />
          <Skeleton className="h-4 w-12 col-span-1" />
        </div>
      </div>
      <div className="divide-y divide-slate-100 p-2 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={`skel-row-${i}`}
            className="px-3 py-2.5 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Skeleton className="h-5 w-24 shrink-0 rounded" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-3/4 max-w-xs rounded" />
                <Skeleton className="h-3 w-1/2 max-w-xxs rounded" />
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-24 rounded hidden sm:block" />
              <Skeleton className="h-2 w-16 rounded-full hidden md:block" />
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-7 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
