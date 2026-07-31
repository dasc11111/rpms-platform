'use client';

import React, { useState } from 'react';
import { Equipment, EquipmentDocument } from './equipment-app';
import { X, Upload, Download, Trash2, FileText } from 'lucide-react';

interface EquipmentDetailModalProps {
    equipment: Equipment | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (equipment: Equipment) => void;
}

type TabKey = 'info' | 'auth' | 'docs' | 'history';

const inputClass = 'w-full px-3 py-2 border border-border bg-background rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent';
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1';

const NEW_EQUIPMENT: Equipment = {
    id: '',
    inventoryNumber: '',
    service: '',
    unit: '',
    location: '',
    equipmentName: '',
    brand: '',
    model: '',
    equipmentSerialNumber: '',
    tubeSerialNumber: '',
    resolutionNumber: '',
    resolutionDate: '',
    authorizationStatus: 'en_tramite',
    observations: '',
    status: 'operativo',
    createdAt: '',
    updatedAt: '',
    lastModifiedBy: '',
    documents: [],
    history: [],
    alerts: [],
};

export function EquipmentDetailModal({ equipment, isOpen, onClose, onSave }: EquipmentDetailModalProps) {
    const [formData, setFormData] = useState<Equipment>(equipment ?? NEW_EQUIPMENT);
    const [activeTab, setActiveTab] = useState<TabKey>('info');

  React.useEffect(() => {
        setFormData(equipment ?? NEW_EQUIPMENT);
        setActiveTab('info');
  }, [equipment, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof Equipment, value: any) => {
        setFormData((prev) => ({
                ...prev,
                [field]: value,
                updatedAt: new Date().toISOString(),
                lastModifiedBy: 'Usuario',
        }));
  };

  const handleAddDocument = (files: FileList | null) => {
        if (!files) return;
        Array.from(files).forEach((file) => {
                const newDoc: EquipmentDocument = {
                          id: Date.now().toString() + Math.random().toString(36).slice(2),
                          name: file.name,
                          type: 'otros',
                          fileUrl: '',
                          fileName: file.name,
                          uploadedAt: new Date().toISOString(),
                          uploadedBy: 'Usuario',
                          size: file.size,
                };
                setFormData((prev) => ({ ...prev, documents: [...prev.documents, newDoc] }));
        });
  };

  const handleRemoveDocument = (docId: string) => {
        setFormData((prev) => ({ ...prev, documents: prev.documents.filter((d) => d.id !== docId) }));
  };

  const handleSave = () => {
        onSave(formData);
  };

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'info', label: 'Informacion' },
    { key: 'auth', label: 'Autorizacion' },
    { key: 'docs', label: 'Documentos' },
    { key: 'history', label: 'Historial' },
      ];

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-surface rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full overflow-y-auto">
                      <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
                                <h2 className="text-lg font-bold text-foreground">
                                  {equipment?.id ? 'Editar Equipo' : 'Nuevo Equipo'}
                                </h2>
                                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                                            <X className="w-5 h-5" />
                                </button>
                      </div>
              
                      <div className="flex gap-1 p-4 pb-0 border-b border-border">
                        {TABS.map((tab) => (
                      <button
                                      key={tab.key}
                                      onClick={() => setActiveTab(tab.key)}
                                      className={activeTab === tab.key ? 'px-4 py-2 text-sm font-medium border-b-2 border-accent text-accent' : 'px-4 py-2 text-sm font-medium text-muted-foreground hover:text-gray-700'}
                                    >
                        {tab.label}
                      </button>
                    ))}
                      </div>
              
                      <div className="p-6">
                        {activeTab === 'info' && (
                      <div className="grid grid-cols-2 gap-4">
                                    <div>
                                                    <label className={labelClass}>Numero Inventario</label>
                                                    <input className={inputClass} value={formData.inventoryNumber} onChange={(e) => handleInputChange('inventoryNumber', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Equipo</label>
                                                    <input className={inputClass} value={formData.equipmentName} onChange={(e) => handleInputChange('equipmentName', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Marca</label>
                                                    <input className={inputClass} value={formData.brand} onChange={(e) => handleInputChange('brand', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Modelo</label>
                                                    <input className={inputClass} value={formData.model} onChange={(e) => handleInputChange('model', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Servicio</label>
                                                    <input className={inputClass} value={formData.service} onChange={(e) => handleInputChange('service', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Unidad</label>
                                                    <input className={inputClass} value={formData.unit} onChange={(e) => handleInputChange('unit', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Ubicacion</label>
                                                    <input className={inputClass} value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Estado</label>
                                                    <select className={inputClass} value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)}>
                                                                      <option value="operativo">Operativo</option>
                                                                      <option value="fuera_de_servicio">Fuera de servicio</option>
                                                                      <option value="prestamo">Prestamo</option>
                                                                      <option value="baja">Baja</option>
                                                    </select>
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Numero Serie Equipo</label>
                                                    <input className={inputClass} value={formData.equipmentSerialNumber} onChange={(e) => handleInputChange('equipmentSerialNumber', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Numero Serie Tubo</label>
                                                    <input className={inputClass} value={formData.tubeSerialNumber} onChange={(e) => handleInputChange('tubeSerialNumber', e.target.value)} />
                                    </div>
                                    <div className="col-span-2">
                                                    <label className={labelClass}>Observaciones</label>
                                                    <textarea className={inputClass} rows={3} value={formData.observations} onChange={(e) => handleInputChange('observations', e.target.value)} />
                                    </div>
                      </div>
                                )}
                      
                        {activeTab === 'auth' && (
                      <div className="grid grid-cols-2 gap-4">
                                    <div>
                                                    <label className={labelClass}>Numero Resolucion</label>
                                                    <input className={inputClass} value={formData.resolutionNumber} onChange={(e) => handleInputChange('resolutionNumber', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Fecha Resolucion</label>
                                                    <input type="date" className={inputClass} value={formData.resolutionDate} onChange={(e) => handleInputChange('resolutionDate', e.target.value)} />
                                    </div>
                                    <div>
                                                    <label className={labelClass}>Estado Autorizacion</label>
                                                    <select className={inputClass} value={formData.authorizationStatus} onChange={(e) => handleInputChange('authorizationStatus', e.target.value)}>
                                                                      <option value="vigente">Vigente</option>
                                                                      <option value="vencida">Vencida</option>
                                                                      <option value="en_tramite">En tramite</option>
                                                                      <option value="suspendida">Suspendida</option>
                                                    </select>
                                    </div>
                      </div>
                                )}
                      
                        {activeTab === 'docs' && (
                      <div className="space-y-4">
                                    <div className="border-2 border-dashed border-border rounded-lg p-6">
                                                    <input
                                                                        type="file"
                                                                        multiple
                                                                        onChange={(e) => handleAddDocument(e.target.files)}
                                                                        className="hidden"
                                                                        id="file-upload"
                                                                      />
                                                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2 text-muted-foreground">
                                                                      <Upload className="w-8 h-8" />
                                                                      <span>Arrastra documentos aqui o haz clic para seleccionar</span>
                                                    </label>
                                    </div>
                        {formData.documents.length > 0 && (
                                        <div className="space-y-2">
                                          {formData.documents.map((doc) => (
                                                              <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/40 rounded">
                                                                                    <div className="flex items-center gap-3">
                                                                                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                                                                                            <div>
                                                                                                                                      <p className="text-sm font-medium text-foreground">{doc.name}</p>
                                                                                                                                      <p className="text-xs text-muted-foreground">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                                                                                              </div>
                                                                                      </div>
                                                                                    <div className="flex gap-2">
                                                                                                            <button className="p-1.5 hover:bg-muted rounded text-muted-foreground">
                                                                                                                                      <Download className="w-4 h-4" />
                                                                                                              </button>
                                                                                                            <button onClick={() => handleRemoveDocument(doc.id)} className="p-1.5 hover:bg-danger-subtle text-danger rounded">
                                                                                                                                      <Trash2 className="w-4 h-4" />
                                                                                                              </button>
                                                                                      </div>
                                                              </div>
                                                            ))}
                                        </div>
                                    )}
                      </div>
                                )}
                      
                        {activeTab === 'history' && (
                      <div className="space-y-3">
                        {formData.history.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Sin historial</p>
                                      ) : (
                                        formData.history.map((entry) => (
                                                            <div key={entry.id} className="p-3 border border-border rounded">
                                                                                <p className="text-sm font-semibold text-foreground">{entry.action}</p>
                                                                                <p className="text-sm text-muted-foreground">{entry.description}</p>
                                                                                <p className="text-xs text-muted-foreground mt-1">{new Date(entry.timestamp).toLocaleString()}</p>
                                                            </div>
                                                          ))
                                      )}
                      </div>
                                )}
                      </div>
              
                      <div className="flex justify-end gap-2 p-4 border-t border-border">
                                <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-md text-foreground hover:bg-muted/40">
                                            Cancelar
                                </button>
                                <button onClick={handleSave} className="px-4 py-2 text-sm bg-accent text-accent-foreground rounded-md hover:bg-accent/90">
                                            Guardar
                                </button>
                      </div>
              </div>
        </div>
      );
}

export type { EquipmentDetailModalProps };
