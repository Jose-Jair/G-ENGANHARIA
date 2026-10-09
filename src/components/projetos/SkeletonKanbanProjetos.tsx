import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonKanbanProjetosProps {
  columns?: number
}

export const SkeletonKanbanProjetos: React.FC<SkeletonKanbanProjetosProps> = ({ columns = 4 }) => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 pt-1 items-start min-h-[500px]">
      {Array.from({ length: columns }).map((_, colIdx) => (
        <div
          key={`skel-kanban-col-${colIdx}`}
          className="w-72 shrink-0 flex flex-col rounded-xl border border-slate-200 bg-slate-100/60 overflow-hidden"
        >
          {/* Header coluna */}
          <div className="p-3 bg-white border-b border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            <Skeleton className="h-3 w-20 rounded" />
          </div>

          {/* Cards coluna */}
          <div className="p-2 space-y-2">
            {Array.from({ length: 3 }).map((__, cardIdx) => (
              <div
                key={`skel-kanban-card-${colIdx}-${cardIdx}`}
                className="bg-white p-3 rounded-lg border border-slate-200 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20 rounded" />
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full rounded" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
