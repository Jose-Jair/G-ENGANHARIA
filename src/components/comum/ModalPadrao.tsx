import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface ModalPadraoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidthClass?: string
  className?: string
  bodyClassName?: string
  headerClassName?: string
  footerClassName?: string
  headerExtra?: React.ReactNode
}

export function ModalPadrao({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidthClass = 'sm:max-w-3xl',
  className,
  bodyClassName,
  headerClassName,
  footerClassName,
  headerExtra,
}: ModalPadraoProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[95vw] p-0 flex flex-col max-h-[90vh] overflow-hidden gap-0 rounded-lg sm:rounded-xl shadow-lg bg-background border border-border',
          maxWidthClass,
          className,
        )}
      >
        <DialogHeader
          className={cn(
            'px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-card shrink-0 text-left',
            headerClassName,
          )}
        >
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="space-y-1 min-w-0 flex-1">
              {typeof title === 'string' ? (
                <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                  {title}
                </DialogTitle>
              ) : (
                <DialogTitle asChild>{title}</DialogTitle>
              )}
              {description &&
                (typeof description === 'string' ? (
                  <DialogDescription className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                    {description}
                  </DialogDescription>
                ) : (
                  <DialogDescription asChild>{description}</DialogDescription>
                ))}
            </div>
            {headerExtra && <div className="shrink-0">{headerExtra}</div>}
          </div>
        </DialogHeader>

        <div
          className={cn(
            'flex-1 overflow-y-auto px-4 sm:px-6 py-4 overscroll-contain',
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer && (
          <DialogFooter
            className={cn(
              'px-4 sm:px-6 py-3 border-t border-border bg-muted/40 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2',
              footerClassName,
            )}
          >
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ModalPadrao
