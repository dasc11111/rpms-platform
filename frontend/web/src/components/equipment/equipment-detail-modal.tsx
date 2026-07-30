'use client';
import React, { useState } from 'react';
import { Equipment, EquipmentDocument } from './equipment-app';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, Trash2, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EquipmentDetailModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (equipment: Equipment) => void;
}

export function EquipmentDetailModal({ equipment, isOpen, onClose, onSave }: EquipmentDetailModalProps) {
  const [formData, setFormData] = useState<Equipment | null>(equipment);

  React.useEffect(() => {
    setFormData(equipment);
  }, [equipment]);

  if (!formData) return null;

  const handleInputChange = (field: keyof Equipment, value: any) => {
    setFormData({
      ...formData,
      [field]: value,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: 'Usuario',
    });
  };

  const handleSave = () => {
    onSave(formData);
  };

  const handleAddDocument = (file: File) => {
    const newDoc: EquipmentDocument = {
      id: Date.now().toString(),
      name: file.name,
      type: 'otros',
      fileUrl: URL.createObjectURL(file),
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Usuario',
      size: file.size,
    };
    setFormData({
      ...formData,
      documents: [...formData.documents, newDoc],
    });
  };

  const handleRemoveDocument = (docId: string) => {
    setFormData({
      ...formData,
      documents: formData.documents.filter((d) => d.id !== docId),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{equipment?.id ? 'Editar Equipo' : 'Nuevo Equipo'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="auth">Autorización</TabsTrigger>
            <TabsTrigger value="docs">Documentos</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nº Inventario</Label>
                <Input value={formData.inventoryNumber} onChange={(e) => handleInputChange('inventoryNumber', e.target.value)} />
              </div>
              <div>
                <Label>Equipo</Label>
                <Input value={formData.equipmentName} onChange={(e) => handleInputChange('equipmentName', e.target.value)} />
              </div>
              <div>
                <Label>Marca</Label>
                <Input value={formData.brand} onChange={(e) => handleInputChange('brand', e.target.value)} />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input value={formData.model} onChange={(e) => handleInputChange('model', e.target.value)} />
              </div>
              <div>
                <Label>Servicio</Label>
                <Input value={formData.service} onChange={(e) => handleInputChange('service', e.target.value)} />
              </div>
              <div>
                <Label>Unidad</Label>
                <Input value={formData.unit} onChange={(e) => handleInputChange('unit', e.target.value)} />
              </div>
              <div>
                <Label>Ubicación</Label>
                <Input value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={formData.status} onValueChange={(v) => handleInputChange('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operativo">Operativo</SelectItem>
                    <SelectItem value="fuera_de_servicio">Fuera Servicio</SelectItem>
                    <SelectItem value="prestamo">Préstamo</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Label>Serie Equipo</Label>
            <Input value={formData.equipmentSerialNumber} onChange={(e) => handleInputChange('equipmentSerialNumber', e.target.value)} />
            <Label>Serie Tubo</Label>
            <Input value={formData.tubeSerialNumber} onChange={(e) => handleInputChange('tubeSerialNumber', e.target.value)} />
            <Label>Observaciones</Label>
            <textarea className="w-full p-2 border rounded-md" value={formData.observations} onChange={(e) => handleInputChange('observations', e.target.value)} rows={3} />
          </TabsContent>

          <TabsContent value="auth" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Resolución</Label>
                <Input value={formData.resolutionNumber} onChange={(e) => handleInputChange('resolutionNumber', e.target.value)} />
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={formData.resolutionDate} onChange={(e) => handleInputChange('resolutionDate', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Estado Autorización</Label>
                <Select value={formData.authorizationStatus} onValueChange={(v) => handleInputChange('authorizationStatus', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vigente">Vigente</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                    <SelectItem value="en_tramite">Trámite</SelectItem>
                    <SelectItem value="suspendida">Suspendida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="docs" className="space-y-4 mt-4">
            <div className="border-2 border-dashed rounded-lg p-6">
              <input type="file" multiple onChange={(e) => Array.from(e.target.files || []).forEach(handleAddDocument)} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8" />
                  <span>Arrastra documentos aquí</span>
                </div>
              </label>
            </div>
            {formData.documents.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Documentos</h4>
                {formData.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4" />
                      <div>
                        <p className="font-semibold text-sm">{doc.name}</p>
                        <p className="text-xs text-slate-600">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost"><Download className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveDocument(doc.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {formData.history.length === 0 ? (
              <p>Sin historial</p>
            ) : (
              formData.history.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="pt-4">
                    <p className="font-semibold">{entry.action}</p>
                    <p className="text-sm">{entry.description}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(entry.timestamp).toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
