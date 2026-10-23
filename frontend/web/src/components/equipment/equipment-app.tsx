'use client';

import React, { useState, useEffect } from 'react';
import { EquipmentList } from './equipment-list';
import { EquipmentDetailModal } from './equipment-detail-modal';
import EquipmentSearchFilters, { FilterState } from './equipment-search-filters';
import EquipmentAlertsPanel, { Alert as AlertItem } from './equipment-alerts-panel';
import { Plus } from 'lucide-react';

export interface Equipment {
    id: string;
    inventoryNumber: string;
    service: string;
    unit: string;
    location: string;
    equipmentName: string;
    brand: string;
    model: string;
    equipmentSerialNumber: string;
    tubeSerialNumber: string;
    resolutionNumber: string;
    resolutionDate: string;
    authorizationStatus: 'vigente' | 'vencida' | 'en_tramite' | 'suspendida';
    observations: string;
    status: 'operativo' | 'fuera_de_servicio' | 'prestamo' | 'baja';
    createdAt: string;
    updatedAt: string;
    lastModifiedBy: string;
    documents: EquipmentDocument[];
    history: EquipmentHistoryEntry[];
    alerts: Alert[];
}

export interface EquipmentDocument {
    id: string;
    name: string;
    type: 'resolucion' | 'oficio' | 'acta_instalacion' | 'certificados' | 'manuales' | 'baja' | 'cambio_tubo' | 'prestamo' | 'otros';
    fileUrl: string;
    fileName: string;
    uploadedAt: string;
    uploadedBy: string;
    size: number;
}

export interface EquipmentHistoryEntry {
    id: string;
    action: string;
    description: string;
    timestamp: string;
    user: string;
    details?: Record<string, any>;
}

export interface Alert {
    id: string;
    type: 'cambio_tubo' | 'cambio_arquitectura' | 'baja' | 'prestamo' | 'vencimiento' | 'en_tramite' | 'documentacion_pendiente';
    message: string;
    severity: 'info' | 'warning' | 'error';
    createdAt: string;
    read: boolean;
}

// Hardcoded seed removed — data is now loaded from /api/equipment

const EMPTY_FILTERS: FilterState = {
    searchTerm: '',
    serviceFilter: [],
    equipmentTypeFilter: [],
    brandFilter: [],
    statusFilter: [],
    authorizationStatus: [],
    dateRange: null,
};

function applyFilters(equipment: Equipment[], filters: FilterState): Equipment[] {
    return equipment.filter((eq) => {
          if (filters.searchTerm) {
                  const term = filters.searchTerm.toLowerCase();
                  const haystack = [
                            eq.inventoryNumber,
                            eq.equipmentName,
                            eq.brand,
                            eq.model,
                            eq.equipmentSerialNumber,
                            eq.tubeSerialNumber,
                            eq.service,
                            eq.unit,
                            eq.location,
                            eq.resolutionNumber,
                            eq.status,
                          ].join(' ').toLowerCase();
                  if (!haystack.includes(term)) return false;
          }
          if (filters.serviceFilter.length > 0 && !filters.serviceFilter.includes(eq.service)) return false;
          if (filters.brandFilter.length > 0 && !filters.brandFilter.includes(eq.brand)) return false;
          if (filters.statusFilter.length > 0) {
                  const statusLabels: Record<string, string> = {
                            operativo: 'Operativo',
                            fuera_de_servicio: 'Fuera de servicio',
                            prestamo: 'En préstamo',
                            baja: 'Dado de baja',
                  };
                  if (!filters.statusFilter.includes((statusLabels[eq.status] ?? ''))) return false;
          }
          if (filters.authorizationStatus.length > 0) {
                  const authLabels: Record<string, string> = {
                            vigente: 'Vigente',
                            vencida: 'Vencida',
                            en_tramite: 'En trámite',
                            suspendida: 'Suspendida',
                  };
                                  if (!filters.authorizationStatus.includes((authLabels[eq.authorizationStatus] ?? ''))) return false;
          }
          return true;
    });
}

export function EquipmentApp() {
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
    const [activeAlerts, setActiveAlerts] = useState<AlertItem[]>([]);

  const filteredEquipment = applyFilters(equipment, filters);

  // Load from API on mount
  useEffect(() => {
    fetch("/api/equipment")
      .then((r) => r.json())
      .then((data: Equipment[]) => {
        if (Array.isArray(data)) setEquipment(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
        const typeMap: Record<Alert['type'], AlertItem['type']> = {
                cambio_tubo: 'cambio_tubo',
                cambio_arquitectura: 'cambio_arquitectura',
                baja: 'documentos',
                prestamo: 'prestamo',
                vencimiento: 'autorizacion_vencida',
                en_tramite: 'autorizacion_tramite',
                documentacion_pendiente: 'documentos',
        };
        const severityMap: Record<Alert['severity'], AlertItem['severity']> = {
                info: 'info',
                warning: 'warning',
                error: 'critical',
        };
        const allAlerts: AlertItem[] = equipment.flatMap((eq) =>
                eq.alerts
                                                                 .filter((a) => !a.read)
                                                                 .map((a) => ({
                                                                             id: a.id,
                                                                             equipmentId: eq.id,
                                                                             equipmentName: eq.equipmentName,
                                                                             type: typeMap[a.type],
                                                                             message: a.message,
                                                                             severity: severityMap[a.severity],
                                                                             createdAt: new Date(a.createdAt),
                                                                             resolved: a.read,
                                                                 }))
                                                             );
        setActiveAlerts(allAlerts);
  }, [equipment]);

  const handleAddEquipment = () => {
        setSelectedEquipment(null);
        setIsDetailModalOpen(true);
  };

  const handleSelectEquipment = (eq: Equipment) => {
        setSelectedEquipment(eq);
        setIsDetailModalOpen(true);
  };

  const handleSaveEquipment = async (updatedEquipment: Equipment) => {
    try {
      if (selectedEquipment) {
        // Update existing
        const res = await fetch(`/api/equipment/${updatedEquipment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedEquipment),
        });
        if (res.ok) {
          const saved: Equipment = await res.json();
          setEquipment(equipment.map((eq) => (eq.id === saved.id ? saved : eq)));
        }
      } else {
        // Create new
        const res = await fetch("/api/equipment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedEquipment),
        });
        if (res.ok) {
          const created: Equipment = await res.json();
          setEquipment([...equipment, created]);
        }
      }
    } catch (err) {
      console.error("handleSaveEquipment", err);
    }
    setIsDetailModalOpen(false);
  };

  const handleDeleteEquipment = async (id: string) => {
    try {
      await fetch(`/api/equipment/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("handleDeleteEquipment", err);
    }
    setEquipment(equipment.filter((eq) => eq.id !== id));
  };

  const handleResolveAlert = (alertId: string) => {
        setEquipment((prev) =>
                prev.map((eq) => ({
                          ...eq,
                          alerts: eq.alerts.map((a) => (a.id === alertId ? { ...a, read: true } : a)),
                }))
                         );
  };

  return (
        <div className="min-h-screen bg-background">
              <div className="max-w-7xl mx-auto p-6 space-y-6">
                      <div className="flex flex-col gap-4">
                                <div>
                                            <h1 className="text-4xl font-bold text-foreground mb-2">Gestion de Equipos Radiologicos</h1>
                                            <p className="text-muted-foreground">Sistema integral de gestion de equipos generadores de radiacion</p>
                                </div>
                                <div className="flex justify-between items-center">
                                            <div className="text-sm text-muted-foreground">
                                                          {loading ? (
                                                            <span>Cargando equipos...</span>
                                                          ) : (
                                                            <>Total de equipos: <span className="font-semibold text-foreground">{equipment.length}</span></>
                                                          )}
                                            </div>
                                            <button
                                                            onClick={handleAddEquipment}
                                                            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 rounded-md text-sm font-medium"
                                                          >
                                                          <Plus className="w-4 h-4" />
                                                          Nuevo Equipo
                                            </button>
                                </div>
                      </div>
              
                {activeAlerts.length > 0 && (
                    <EquipmentAlertsPanel alerts={activeAlerts} onResolveAlert={handleResolveAlert} />
                  )}
              
                      <EquipmentSearchFilters onFiltersChange={setFilters} />
              
                      <EquipmentList
                                  equipment={filteredEquipment}
                                  onSelectEquipment={handleSelectEquipment}
                                  onDeleteEquipment={handleDeleteEquipment}
                                />
              </div>
        
              <EquipmentDetailModal
                        equipment={selectedEquipment}
                        isOpen={isDetailModalOpen}
                        onClose={() => setIsDetailModalOpen(false)}
                        onSave={handleSaveEquipment}
                      />
        </div>
      );
}
