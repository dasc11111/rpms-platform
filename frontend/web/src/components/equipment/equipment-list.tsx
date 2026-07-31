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
    operativo: 'bg-green-100 text-green-800',
    fuera_de_servicio: 'bg-red-100 text-red-800',
    prestamo: 'bg-blue-100 text-blue-800',
    baja: 'bg-gray-100 text-gray-800',
};

const AUTH_STATUS_STYLES: Record<string, string> = {
    vigente: 'bg-green-50 border-green-200',
    vencida: 'bg-red-50 border-red-200',
    en_tramite: 'bg-yellow-50 border-yellow-200',
    suspendida: 'bg-red-50 border-red-200',
};

const AUTH_BADGE_STYLES: Record<string, string> = {
    vigente: 'bg-green-100 text-green-800',
    vencida: 'bg-red-100 text-red-800',
    en_tramite: 'bg-yellow-100 text-yellow-800',
    suspendida: 'bg-red-100 text-red-800',
};

export function EquipmentList({ equipment, onSelectEquipment, onDeleteEquipment }: EquipmentListProps) {
    if (equipment.length === 0) {
          return (
                  <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
                          No hay equipos registrados que coincidan con los filtros.
                  </div>
                );
    }
  
    return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipment.map((eq) => (
                    <div
                                key={eq.id}
                                className={`rounded-lg border shadow-sm cursor-pointer transition-all hover:shadow-lg border-l-4 bg-white ${AUTH_STATUS_STYLES[eq.authorizationStatus]}`}
                              >
                              <div className="p-4 pb-3 border-b border-gray-100">
                                          <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                                        <h3 className="text-lg font-semibold text-gray-800">{eq.equipmentName}</h3>
                                                                        <p className="text-sm text-slate-600 mt-1">
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
                                                                        <p className="text-slate-600">Marca</p>
                                                                        <p className="font-semibold">{eq.brand}</p>
                                                        </div>
                                                        <div>
                                                                        <p className="text-slate-600">Modelo</p>
                                                                        <p className="font-semibold">{eq.model}</p>
                                                        </div>
                                                        <div>
                                                                        <p className="text-slate-600">Servicio</p>
                                                                        <p className="font-semibold">{eq.service}</p>
                                                        </div>
                                                        <div>
                                                                        <p className="text-slate-600">Ubicacion</p>
                                                                        <p className="font-semibold">{eq.location}</p>
                                                        </div>
                                          </div>
                              
                                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                                        <span className="text-xs text-slate-600">Autorizacion</span>
                                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${AUTH_BADGE_STYLES[eq.authorizationStatus]}`}>
                                                          {eq.authorizationStatus.replace('_', ' ').toUpperCase()}
                                                        </span>
                                          </div>
                              
                                {eq.alerts && eq.alerts.length > 0 && (
                                              <div className="pt-2 border-t bg-yellow-50 p-2 rounded">
                                                              <p className="text-xs font-semibold text-yellow-800 mb-1 flex items-center gap-1">
                                                                                <AlertTriangle className="w-3 h-3" /> Alertas ({eq.alerts.length})
                                                              </p>
                                                              <div className="space-y-1">
                                                                {eq.alerts.slice(0, 2).map((alert) => (
                                                                    <p key={alert.id} className="text-xs text-yellow-700">
                                                                                          &bull; {alert.message}
                                                                    </p>
                                                                  ))}
                                                              </div>
                                              </div>
                                          )}
                              
                                          <div className="flex gap-2 pt-2 border-t border-gray-100">
                                                        <button
                                                                          onClick={() => onSelectEquipment(eq)}
                                                                          className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                                                                        >
                                                                        <Eye className="w-4 h-4" /> Ver Detalles
                                                        </button>
                                                        <button
                                                                          onClick={() => onDeleteEquipment(eq.id)}
                                                                          className="flex items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:border-red-200"
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
