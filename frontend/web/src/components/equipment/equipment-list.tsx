'use client';

import React from 'react';
import { Equipment } from './equipment-app';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Eye, AlertTriangle } from 'lucide-react';

interface EquipmentListProps {
  equipment: Equipment[];
  onSelectEquipment: (eq: Equipment) => void;
  onDeleteEquipment: (id: string) => void;
}

const STATUS_STYLES = {
  operativo: 'bg-green-100 text-green-800',
  fuera_de_servicio: 'bg-red-100 text-red-800',
  prestamo: 'bg-blue-100 text-blue-800',
  baja: 'bg-gray-100 text-gray-800',
};

const AUTH_STATUS_STYLES = {
  vigente: 'bg-green-50 border-green-200',
  vencida: 'bg-red-50 border-red-200',
  en_tramite: 'bg-yellow-50 border-yellow-200',
  suspendida: 'bg-red-50 border-red-200',
};

export function EquipmentList({
  equipment,
  onSelectEquipment,
  onDeleteEquipment,
}: EquipmentListProps) {
  if (equipment.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500 text-lg">No hay equipos que coincidan con los filtros</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
      {equipment.map((eq) => (
        <Card
          key={eq.id}
          className={`cursor-pointer transition-all hover:shadow-lg border-l-4 ${
            AUTH_STATUS_STYLES[eq.authorizationStatus]
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-lg">{eq.equipmentName}</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  <strong>Nº Inventario:</strong> {eq.inventoryNumber}
                </p>
              </div>
              <Badge className={STATUS_STYLES[eq.status]}>
                {eq.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Grid de información */}
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
                <p className="text-slate-600">Ubicación</p>
                <p className="font-semibold">{eq.location}</p>
              </div>
            </div>

            {/* Información de autorización */}
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-600">Resolución</p>
                  <p className="font-semibold text-sm">{eq.resolutionNumber}</p>
                </div>
                <Badge
                  variant={
                    eq.authorizationStatus === 'vigente'
                      ? 'default'
                      : eq.authorizationStatus === 'en_tramite'
                      ? 'secondary'
                      : 'destructive'
                  }
                >
                  {eq.authorizationStatus.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Alertas si existen */}
            {eq.alerts.length > 0 && (
              <div className="pt-2 border-t bg-yellow-50 p-2 rounded">
                <p className="text-xs font-semibold text-yellow-800 mb-1">Alertas ({eq.alerts.length})</p>
                <div className="space-y-1">
                  {eq.alerts.slice(0, 2).map((alert) => (
                    <p key={alert.id} className="text-xs text-yellow-700">
                      • {alert.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onSelectEquipment(eq)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver Detalles
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => onDeleteEquipment(eq.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
