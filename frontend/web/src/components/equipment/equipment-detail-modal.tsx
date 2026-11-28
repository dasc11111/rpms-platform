'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Equipment, EquipmentDocument } from './equipment-app';
import { X, Upload, Download, Trash2, FileText, Eye, FileSpreadsheet } from 'lucide-react';

interface EquipmentDetailModalProps {
    equipment: Equipment | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (equipment: Equipment) => void;
}

type TabKey = 'info' | 'auth' | 'docs' | 'history';

interface BackendDoc {
  id: string;
  owner_type: string;
  owner_id: string;
  category: string;
  original_name: string;
  blob_url: string;
  blob_pathname: string;
  size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

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

function isPreviewable(mimeType: string | null | undefined): 'pdf' | 'image' | null {
  if (!mimeType) return null;
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PreviewModal({ docId, name, onClose }: { docId: string; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/80" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border" onClick={e => e.stopPropagation()}>
        <span className="text-sm font-medium text-foreground truncate max-w-[70vw]">{name}</span>
        <div className="flex gap-2">
          <a
            href={`/api/equipment/documents/${docId}/download?dl=1`}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-accent text-accent-foreground rounded hover:bg-accent/90"
            onClick={e => e.stopPropagation()}
          >
            <Download className="w-3 h-3" /> Descargar
          </a>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1" onClick={e => e.stopPropagation()}>
        <iframe
          src={`/api/equipment/documents/${docId}/download`}
          className="w-full h-full border-0"
          title={name}
        />
      </div>
    </div>
  );
}

export function EquipmentDetailModal({ equipment, isOpen, onClose, onSave }: EquipmentDetailModalProps) {
    const [formData, setFormData] = useState<Equipment>(equipment ?? NEW_EQUIPMENT);
    const [activeTab, setActiveTab] = useState<TabKey>('info');
    const [backendDocs, setBackendDocs] = useState<BackendDoc[]>([]);
    const [uploading, setUploading] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<BackendDoc | null>(null);

    const fetchDocs = useCallback(async (equipmentId: string) => {
      if (!equipmentId) return;
      try {
        const res = await fetch(`/api/equipment/documents?ownerType=equipment&ownerId=${equipmentId}`);
        if (res.ok) {
          const data = await res.json();
          setBackendDocs(data.documents ?? []);
        }
      } catch {}
    }, []);

    useEffect(() => {
        setFormData(equipment ?? NEW_EQUIPMENT);
        setActiveTab('info');
        setBackendDocs([]);
        if (equipment?.id) fetchDocs(equipment.id);
    }, [equipment, isOpen, fetchDocs]);

    if (!isOpen) return null;

    const handleInputChange = (field: keyof Equipment, value: any) => {
        setFormData((prev) => ({
                ...prev,
                [field]: value,
                updatedAt: new Date().toISOString(),
                lastModifiedBy: 'Usuario',
        }));
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || !formData.id) return;
        setUploading(true);
        try {
          const form = new FormData();
          Array.from(files).forEach(f => form.append('files', f));
          form.append('ownerType', 'equipment');
          form.append('ownerId', formData.id);
          form.append('category', 'autorizacion');
          const res = await fetch('/api/equipment/documents', { method: 'POST', body: form });
          if (res.ok) await fetchDocs(formData.id);
        } finally {
          setUploading(false);
        }
    };

    const handleRemoveDoc = async (doc: BackendDoc) => {
        if (!confirm(`¿Eliminar "${doc.original_name}"?`)) return;
        await fetch(`/api/equipment/documents?id=${doc.id}`, { method: 'DELETE' });
        setBackendDocs(prev => prev.filter(d => d.id !== doc.id));
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

    const isNewEquipment = !formData.id;

    return (
        <>
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
                            className={activeTab === tab.key ? 'px-4 py-2 text-sm font-medium border-b-2 border-accent text-accent' : 'px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground'}
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
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">
                                Documentos adjuntos ({backendDocs.length})
                              </span>
                              <a
                                href="/api/equipment/export/xls"
                                download
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Exportar XLS
                              </a>
                            </div>

                            {isNewEquipment ? (
                              <p className="text-sm text-muted-foreground bg-muted/40 p-4 rounded">
                                Guarda el equipo primero para poder adjuntar documentos.
                              </p>
                            ) : (
                              <>
                                <div className="border-2 border-dashed border-border rounded-lg p-6">
                                  <input
                                    type="file"
                                    multiple
                                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                                    onChange={(e) => handleFileUpload(e.target.files)}
                                    className="hidden"
                                    id="equipment-file-upload"
                                    disabled={uploading}
                                  />
                                  <label htmlFor="equipment-file-upload" className={`cursor-pointer flex flex-col items-center gap-2 text-muted-foreground ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <Upload className="w-8 h-8" />
                                    <span>{uploading ? 'Subiendo...' : 'Arrastra documentos aqui o haz clic para seleccionar'}</span>
                                    <span className="text-xs">PDF, PNG, JPG aceptados</span>
                                  </label>
                                </div>

                                {backendDocs.length > 0 && (
                                  <div className="space-y-2">
                                    {backendDocs.map((doc) => {
                                      const preview = isPreviewable(doc.mime_type);
                                      return (
                                        <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/40 rounded">
                                          <div className="flex items-center gap-3">
                                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-foreground truncate max-w-xs">{doc.original_name}</p>
                                              <p className="text-xs text-muted-foreground">
                                                {new Date(doc.created_at).toLocaleDateString('es-CL')}
                                                {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ''}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex gap-1 shrink-0">
                                            {preview && (
                                              <button
                                                onClick={() => setPreviewDoc(doc)}
                                                className="p-1.5 hover:bg-muted rounded text-accent"
                                                title="Vista previa"
                                              >
                                                <Eye className="w-4 h-4" />
                                              </button>
                                            )}
                                            <a
                                              href={`/api/equipment/documents/${doc.id}/download?dl=1`}
                                              className="p-1.5 hover:bg-muted rounded text-muted-foreground"
                                              title="Descargar"
                                            >
                                              <Download className="w-4 h-4" />
                                            </a>
                                            <button
                                              onClick={() => handleRemoveDoc(doc)}
                                              className="p-1.5 hover:bg-danger-subtle text-danger rounded"
                                              title="Eliminar"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {backendDocs.length === 0 && !uploading && (
                                  <p className="text-sm text-muted-foreground text-center py-2">
                                    No hay documentos adjuntos
                                  </p>
                                )}
                              </>
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

          {previewDoc && (
            <PreviewModal
              docId={previewDoc.id}
              name={previewDoc.original_name}
              onClose={() => setPreviewDoc(null)}
            />
          )}
        </>
    );
}

export type { EquipmentDetailModalProps };
