'use client';

import React from 'react';
import { Equipment } from './equipment-app';
import { Trash2, Eye, AlertTriangle } from 'lucide-react';

interface EquipmentListProps {
    equipment: Equipment[];
    onSelectEquipment: (eq: Equipment) => void;
    onDeleteEquipment: (id: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
    operativo: 'bg-success-subtle text-success',
    fuera_de_servicio: 'bg-danger-subtle text-danger',
    prestamo: 'bg-info-subtle text-info',
    baja: 'bg-muted text-muted-foreground',
};

const AUTH_STATUS_STYLES: Record<string, string> = {
    vigente: 'border-success/50',
    vencida: 'border-danger/50',
    en_tramite: 'border-warning/50',
    suspendida: 'border-danger/50',
};

const AUTH_BADGE_STYLES: Record<string, string> = {
    vigente: 'bg-success-subtle text-success',
    vencida: 'bg-danger-subtle text-danger',
    en_tramite: 'bg-warning-subtle text-warning',
    suspendida: 'bg-danger-subtle text-danger',
};

export function EquipmentList({ equipment, onSelectEquipment, onDeleteEquipment }: EquipmentListProps) {
    if (equipment.length === 0) {
          return (
                  <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
                          No hay equipos registrados que coincidan con los filtros.
                  </div>
                );
    }
  
    return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipment.map((eq) => (
                    <div
                                key={eq.id}
                                className={`rounded-lg border shadow-sm cursor-pointer transition-all hover:shadow-lg border border-border border-l-4 bg-surface ${AUTH_STATUS_STYLES[eq.authorizationStatus]}`}
                              >
                              <div className="p-4 pb-3 border-b border-border">
                                          <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                                        <h3 className="text-lg font-semibold text-foreground">{eq.equipmentName}</h3>
                                                                        <p className="text-sm text-muted-foreground mt-1">
                                                                                          <strong>N&ordm; Inventario:</strong> {eq.inventoryNumber}
                                                                        </p>
                                                        </div>
                                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[eq.status]}`}>
                                                          {eq.status.replace('_', ' ').toUpperCase()}
                                                        </span>
                                          </div>
                              </div>
                    
                              <div className="p-4 space-y-3">
                                          <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                                        <p className="text-muted-foreground">Marca</p>
                                                                        <p className="font-semibold text-foreground">{eq.brand}</p>
                                                        </div>
                                                        <div>
                                                                        <p className="text-muted-foreground">Modelo</p>
                                                                        <p className="font-semibold text-foreground">{eq.model}</p>
                                                        </div>
                                                        <div>
                                                                        <p className="text-muted-foreground">Servicio</p>
                                                                        <p className="font-semibold text-foreground">{eq.service}</p>
                                                        </div>
                                                        <div>
                                                                        <p className="text-muted-foreground">Ubicacion</p>
                                                                        <p className="font-semibold text-foreground">{eq.location}</p>
                                                        </div>
                                          </div>
                              
                                          <div className="flex items-center justify-between pt-2 border-t border-border">
                                                        <span className="text-xs text-muted-foreground">Autorizacion</span>
                                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${AUTH_BADGE_STYLES[eq.authorizationStatus]}`}>
                                                          {eq.authorizationStatus.replace('_', ' ').toUpperCase()}
                                                        </span>
                                          </div>
                              
                                {eq.alerts && eq.alerts.length > 0 && (
                                              <div className="pt-2 border-t border-border bg-warning-subtle p-2 rounded">
                                                              <p className="text-xs font-semibold text-warning mb-1 flex items-center gap-1">
                                                                                <AlertTriangle className="w-3 h-3" /> Alertas ({eq.alerts.length})
                                                              </p>
                                                              <div className="space-y-1">
                                                                {eq.alerts.slice(0, 2).map((alert) => (
                                                                    <p key={alert.id} className="text-xs text-warning">
                                                                                          &bull; {alert.message}
                                                                    </p>
                                                                  ))}
                                                              </div>
                                              </div>
                                          )}
                              
                                          <div className="flex gap-2 pt-2 border-t border-border">
                                                        <button
                                                                          onClick={() => onSelectEquipment(eq)}
                                                                          className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/40"
                                                                        >
                                                                        <Eye className="w-4 h-4" /> Ver Detalles
                                                        </button>
                                                        <button
                                                                          onClick={() => onDeleteEquipment(eq.id)}
                                                                          className="flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-danger hover:bg-danger-subtle hover:border-danger/40"
                                                                        >
                                                                        <Trash2 className="w-4 h-4" />
                                                        </button>
                                          </div>
                              </div>
                    </div>
                  ))}
          </div>
        );
}

export type { EquipmentListProps };
