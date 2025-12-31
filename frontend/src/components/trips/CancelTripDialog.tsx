import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'

interface CancelTripDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason?: string) => Promise<void>
  tripNumber?: string
  isLoading?: boolean
}

export function CancelTripDialog({
  open,
  onOpenChange,
  onConfirm,
  tripNumber,
  isLoading = false,
}: CancelTripDialogProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')

  const handleConfirm = async () => {
    await onConfirm(reason.trim() || undefined)
    setReason('')
  }

  const handleCancel = () => {
    setReason('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('trip.cancelTitle') || 'Cancelar Viaje'}
          </DialogTitle>
          <DialogDescription>
            {tripNumber
              ? t('trip.cancelDescription') || `¿Estás seguro de que deseas cancelar el viaje ${tripNumber}?`
              : t('trip.cancelDescriptionGeneric') || '¿Estás seguro de que deseas cancelar este viaje?'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              {t('trip.cancelReason') || 'Razón de cancelación (opcional)'}
            </Label>
            <Textarea
              id="reason"
              placeholder={t('trip.cancelReasonPlaceholder') || 'Explica por qué estás cancelando este viaje...'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            {t('trip.cancelWarning') || 'Al cancelar este viaje, se liberará el vehículo asignado y se cancelarán los pagos pendientes.'}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {t('common.cancel') || 'No, mantener'}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading
              ? (t('common.cancelling') || 'Cancelando...')
              : (t('trip.confirmCancel') || 'Sí, cancelar viaje')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

