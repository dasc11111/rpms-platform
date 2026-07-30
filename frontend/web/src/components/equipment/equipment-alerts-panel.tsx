'use client';

import React, { useMemo } from 'react';
import { AlertCircle, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface Alert {
    id: string;
    equipmentId: string;
    equipmentName: string;
    type: 'cambio_tubo' | 'cambio_arquitectura' | 'autorizacion_vencida' | 'autorizacion_tramite' | 'prestamo' | 'documentos';
    message: string;
    severity: 'critical' | 'warning' | 'info';
    createdAt: Date;
    resolved: boolean;
    dueDate?: Date;
}

interface AlertsPanelProps {
    alerts: Alert[];
    onResolveAlert?: (alertId: string) => void;
    maxVisible?: number;
}

const EquipmentAlertsPanel: React.FC<AlertsPanelProps> = ({
    alerts,
    onResolveAlert,
    maxVisible = 5,
}) => {
    const alertTypeLabels: Record<Alert['type'], string> = {
          cambio_tubo: 'Cambio de tubo',
          cambio_arquitectura: 'Cambio de arquitectura',
          autorizacion_vencida: 'Autorización vencida',
          autorizacion_tramite: 'Autorización en trámite',
          prestamo: 'Equipo en préstamo',
          documentos: 'Documentación pendiente',
    };

    const activeAlerts = useMemo(() => alerts.filter(a => !a.resolved), [alerts]);

    const alertsByCategory = useMemo(() => {
          return {
                  critical: activeAlerts.filter(a => a.severity === 'critical'),
                  warning: activeAlerts.filter(a => a.severity === 'warning'),
                  info: activeAlerts.filter(a => a.severity === 'info'),
          };
    }, [activeAlerts]);

    const getSeverityColor = (severity: Alert['severity']) => {
          switch (severity) {
            case 'critical': return 'bg-red-50 border-red-200';
            case 'warning': return 'bg-yellow-50 border-yellow-200';
            case 'info': return 'bg-blue-50 border-blue-200';
            default: return 'bg-gray-50 border-gray-200';
          }
    };

    const getSeverityIcon = (severity: Alert['severity']) => {
          switch (severity) {
            case 'critical': return <AlertCircle className="text-red-600" size={20} />;
            case 'warning': return <AlertTriangle className="text-yellow-600" size={20} />;
            case 'info': return <Clock className="text-blue-600" size={20} />;
            default: return <CheckCircle className="text-gray-600" size={20} />;
          }
    };

    const formatDate = (date: Date) => {
          return new Date(date).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
          });
    };

    const AlertItem = ({ alert }: { alert: Alert }) => (
          <div className={`border rounded-lg p-3 ${getSeverityColor(alert.severity)}`}>
                  <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">{getSeverityIcon(alert.severity)}</div>
                          <div className="flex-grow">
                                    <div className="flex items-center justify-between">
                                                <h4 className="font-semibold text-gray-800">{alert.equipmentName}</h4>
                                                <span className="text-xs bg-white px-2 py-1 rounded text-gray-600">
                                                  {alertTypeLabels[alert.type]}
                                                </span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                                    <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-gray-500">{formatDate(alert.createdAt)}</span>
                                      {onResolveAlert && (
                          <button
                                            onClick={() => onResolveAlert(alert.id)}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                          >
                                          Resolver
                          </button>
                                                )}
                                    </div>
                          </div>
                  </div>
          </div>
        );
  
    return (
          <div className="bg-white rounded-lg shadow p-4">
                <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                  <AlertCircle size={24} className="text-red-600" />
                                  Centro de Alertas
                        </h2>
                  {activeAlerts.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {activeAlerts.length} alerta{activeAlerts.length !== 1 ? 's' : ''} pendiente{activeAlerts.length !== 1 ? 's' : ''}
                      </p>
                        )}
                </div>
          
            {activeAlerts.length === 0 ? (
                    <div className="py-8 text-center">
                              <CheckCircle className="mx-auto mb-3 text-green-600" size={40} />
                              <p className="text-gray-600">No hay alertas pendientes</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alertsByCategory.critical.length > 0 && (
                                  <div>
                                                <h3 className="text-sm font-semibold text-red-700 mb-2">
                                                                Críticas ({alertsByCategory.critical.length})
                                                </h3>
                                                <div className="space-y-2">
                                                  {alertsByCategory.critical.slice(0, maxVisible).map((alert) => (
                                                      <AlertItem key={alert.id} alert={alert} />
                                                    ))}
                                                </div>
                                  </div>
                              )}
                    
                      {alertsByCategory.warning.length > 0 && (
                                  <div>
                                                <h3 className="text-sm font-semibold text-yellow-700 mb-2">
                                                                Advertencias ({alertsByCategory.warning.length})
                                                </h3>
                                                <div className="space-y-2">
                                                  {alertsByCategory.warning.slice(0, maxVisible).map((alert) => (
                                                      <AlertItem key={alert.id} alert={alert} />
                                                    ))}
                                                </div>
                                  </div>
                              )}
                    
                      {alertsByCategory.info.length > 0 && (
                                  <div>
                                                <h3 className="text-sm font-semibold text-blue-700 mb-2">
                                                                Información ({alertsByCategory.info.length})
                                                </h3>
                                                <div className="space-y-2">
                                                  {alertsByCategory.info.slice(0, maxVisible).map((alert) => (
                                                      <AlertItem key={alert.id} alert={alert} />
                                                    ))}
                                                </div>
                                  </div>
                              )}
                    
                      {Math.max(
                                  alertsByCategory.critical.length,
                                  alertsByCategory.warning.length,
                                  alertsByCategory.info.length
                                ) > maxVisible && (
                                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium w-full py-2 mt-2 border-t">
                                                Ver todas las alertas
                                  </button>
                              )}
                    </div>
                )}
          </div>
        );
};

export default EquipmentAlertsPanel;
export type { Alert, AlertsPanelProps };</div>
