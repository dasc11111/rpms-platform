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

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  // Radiodiagnóstico
  { value: 'xray', label: 'Rayos X' },
  { value: 'ct', label: 'Tomografía Computada (CT)' },
  { value: 'mri', label: 'Resonancia Magnética (RM)' },
  { value: 'mammography', label: 'Mamografía' },
  { value: 'densitometry', label: 'Densitometría' },
  { value: 'fluoroscopy', label: 'Fluoroscopía' },
  { value: 'ultrasound', label: 'Ecografía / Ultrasonido' },
  // Medicina Nuclear
  { value: 'gamma_camera', label: 'Gammacámara' },
  { value: 'pet_ct', label: 'PET/CT' },
  { value: 'dose_calibrator', label: 'Calibrador de Dosis' },
  { value: 'survey_meter', label: 'Monitor de Área (Survey Meter)' },
  // Radioterapia
  { value: 'rad_therapy', label: 'Radioterapia (Linac/Braquiterapia)' },
  // Otro
  { value: 'other', label: 'Otro' },
];

const NEW_EQUIPMENT: Equipment = {
    id: '',
    inventoryNumber: '',
    service: '',
    unit: '',
    location: '',
    equipmentName: '',
    brand: '',
    model: '',
    category: 'other',
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
                              <label className={labelClass}>Tipo de Equipo</label>
                              <select className={inputClass} value={(formData as any).category ?? 'other'} onChange={(e) => handleInputChange('category', e.target.value)}>
                                <optgroup label="Radiodiagnóstico">
                                  <option value="xray">Rayos X</option>
                                  <option value="ct">Tomografía Computada (CT)</option>
                                  <option value="mri">Resonancia Magnética (RM)</option>
                                  <option value="mammography">Mamografía</option>
                                  <option value="densitometry">Densitometría</option>
                                  <option value="fluoroscopy">Fluoroscopía</option>
                                  <option value="ultrasound">Ecografía / Ultrasonido</option>
                                </optgroup>
                                <optgroup label="Medicina Nuclear">
                                  <option value="gamma_camera">Gammacámara</option>
                                  <option value="pet_ct">PET/CT</option>
                                  <option value="dose_calibrator">Calibrador de Dosis</option>
                                  <option value="survey_meter">Monitor de Área (Survey Meter)</option>
                                </optgroup>
                                <optgroup label="Radioterapia">
                                  <option value="rad_therapy">Radioterapia (Linac/Braquiterapia)</option>
                                </optgroup>
                                <optgroup label="Otro">
                                  <option value="other">Otro</option>
                                </optgroup>
                              </select>
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
                          <div className="space-y-6">
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

                            <div className="border-t border-border pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-foreground">
                                  Autorizacion de Operacion (PDF)
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {backendDocs.filter(d => d.category === 'autorizacion').length} documento(s)
                                </span>
                              </div>

                              {isNewEquipment ? (
                                <p className="text-sm text-muted-foreground bg-muted/40 p-4 rounded">
                                  Guarda el equipo primero para poder adjuntar la autorizacion.
                                </p>
                              ) : (
                                <>
                                  <div className="border-2 border-dashed border-border rounded-lg p-4 mb-3">
                                    <input
                                      type="file"
                                      accept=".pdf"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file || !equipment?.id) return;
                                        const body = new FormData();
                                        body.append('files', file);
                                        body.append('categories', 'autorizacion');
                                        await fetch(`/api/equipment/documents?equipmentId=${equipment.id}`, { method: 'POST', body });
                                        const res = await fetch(`/api/equipment/${equipment.id}`);
                                        if (res.ok) {
                                          const data = await res.json();
                                          setBackendDocs(data.documents ?? []);
                                        }
                                        e.target.value = '';
                                      }}
                                      className="hidden"
                                      id="auth-upload"
                                    />
                                    <label htmlFor="auth-upload" className="flex flex-col items-center gap-2 cursor-pointer">
                                      <Upload className="w-6 h-6 text-muted-foreground" />
                                      <span className="text-sm text-muted-foreground">Subir PDF de Autorizacion</span>
                                    </label>
                                  </div>

                                  {backendDocs.filter(d => d.category === 'autorizacion').length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No hay documentos de autorizacion adjuntos.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {backendDocs.filter(d => d.category === 'autorizacion').map((doc) => (
                                        <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <span className="text-sm text-foreground truncate">{doc.original_name}</span>
                                          </div>
                                          <div className="flex items-center gap-1 ml-2 shrink-0">
                                            <button
                                              onClick={() => setPreviewDoc(doc)}
                                              className="p-1.5 text-muted-foreground hover:text-accent"
                                              title="Vista previa"
                                            >
                                              <Eye className="w-4 h-4" />
                                            </button>
                                            <a
                                              href={`/api/equipment/documents/${doc.id}/download?dl=1`}
                                              className="p-1.5 text-muted-foreground hover:text-accent"
                                              title="Descargar"
                                            >
                                              <Download className="w-4 h-4" />
                                            </a>
                                            <button
                                              onClick={async () => {
                                                await fetch(`/api/equipment/documents/${doc.id}`, { method: 'DELETE' });
                                                setBackendDocs(prev => prev.filter(d => d.id !== doc.id));
                                              }}
                                              className="p-1.5 text-muted-foreground hover:text-danger"
                                              title="Eliminar"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
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
