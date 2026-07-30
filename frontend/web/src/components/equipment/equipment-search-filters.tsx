'use client';

import React, { useState, useCallback } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface SearchFiltersProps {
    onFiltersChange: (filters: FilterState) => void;
}

export interface FilterState {
    searchTerm: string;
    serviceFilter: string[];
    equipmentTypeFilter: string[];
    brandFilter: string[];
    statusFilter: string[];
    authorizationStatus: string[];
    dateRange: { start: string; end: string } | null;
}

const EquipmentSearchFilters: React.FC<SearchFiltersProps> = ({
    onFiltersChange,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<Omit<FilterState, 'searchTerm'>>({
          serviceFilter: [],
          equipmentTypeFilter: [],
          brandFilter: [],
          statusFilter: [],
          authorizationStatus: [],
          dateRange: null,
    });
    const [expandedSections, setExpandedSections] = useState({
          service: false,
          equipment: false,
          brand: false,
          status: false,
          authorization: false,
          date: false,
    });

    const toggleSection = useCallback((section: keyof typeof expandedSections) => {
          setExpandedSections((prev) => ({
                  ...prev,
                  [section]: !prev[section],
          }));
    }, []);

    const handleSearchChange = useCallback((value: string) => {
          setSearchTerm(value);
          onFiltersChange({ searchTerm: value, ...filters });
    }, [filters, onFiltersChange]);

    const toggleFilter = useCallback(
          (
                  filterType: 'serviceFilter' | 'equipmentTypeFilter' | 'brandFilter' | 'statusFilter' | 'authorizationStatus',
                  value: string
                ) => {
                        setFilters((prev) => {
                                  const updated = { ...prev };
                                  const filterArray = updated[filterType];
                                  const index = filterArray.indexOf(value);

                                           if (index >= 0) {
                                                       filterArray.splice(index, 1);
                                           } else {
                                                       filterArray.push(value);
                                           }

                                           onFiltersChange({ searchTerm, ...updated });
                                  return updated;
                        });
                },
          [searchTerm, onFiltersChange]
        );

    const clearAllFilters = useCallback(() => {
          setSearchTerm('');
          setFilters({
                  serviceFilter: [],
                  equipmentTypeFilter: [],
                  brandFilter: [],
                  statusFilter: [],
                  authorizationStatus: [],
                  dateRange: null,
          });
          onFiltersChange({
                  searchTerm: '',
                  serviceFilter: [],
                  equipmentTypeFilter: [],
                  brandFilter: [],
                  statusFilter: [],
                  authorizationStatus: [],
                  dateRange: null,
          });
    }, [onFiltersChange]);

    const serviceOptions = ['Radiología', 'Oncología', 'Cardiología', 'Urgencias'];
    const equipmentTypes = ['Rayos X', 'Tomógrafo', 'Resonancia', 'Mamógrafo', 'Densitómetro'];
    const brandOptions = ['GE', 'Siemens', 'Philips', 'Canon', 'Carestream'];
    const statusOptions = ['Operativo', 'Fuera de servicio', 'En préstamo', 'Dado de baja'];
    const authorizationOptions = ['Vigente', 'Vencida', 'En trámite'];

    const FilterSection = ({
          title,
          section,
          options,
          selectedValues,
    }: {
          title: string;
          section: keyof typeof expandedSections;
          options: string[];
          selectedValues: string[];
    }) => (
          <div className="border-b border-gray-200 py-4">
                <button
                          onClick={() => toggleSection(section)}
                          className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded"
                        >
                        <h3 className="font-semibold text-gray-700">{title}</h3>h3>
                        <ChevronDown
                                    size={20}
                                    className={`transition-transform ${expandedSections[section] ? 'rotate-180' : ''}`}
                                  />
                </button>button>
            {expandedSections[section] && (
                    <div className="mt-3 space-y-2 pl-2">
                      {options.map((option) => (
                                  <label key={option} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                <input
                                                                  type="checkbox"
                                                                  checked={selectedValues.includes(option)}
                                                                  onChange={() => toggleFilter(
                                                                                      title === 'Servicio' ? 'serviceFilter' :
                                                                                      title === 'Equipo' ? 'equipmentTypeFilter' :
                                                                                      title === 'Marca' ? 'brandFilter' :
                                                                                      title === 'Estado' ? 'statusFilter' : 'authorizationStatus',
                                                                                      option
                                                                                    )}
                                                                  className="w-4 h-4"
                                                                />
                                                <span className="text-sm text-gray-600">{option}</span>span>
                                  </label>label>
                                ))}
                    </div>div>
                )}
          </div>div>
        );
  
    return (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="mb-4">
                        <div className="flex items-center justify-between mb-3">
                                  <h2 className="text-lg font-bold text-gray-800">Filtros y Búsqueda</h2>h2>
                          {Object.values(filters).some(f => f && (Array.isArray(f) ? f.length > 0 : true)) && (
                        <button
                                        onClick={clearAllFilters}
                                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                      >
                                      <X size={16} /> Limpiar filtros
                        </button>button>
                                  )}
                        </div>div>
                        <input
                                    type="text"
                                    placeholder="Buscar por inventario, equipo, marca, modelo, serie..."
                                    value={searchTerm}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                </div>div>
          
                <div className="space-y-2">
                        <FilterSection title="Servicio" section="service" options={serviceOptions} selectedValues={filters.serviceFilter} />
                        <FilterSection title="Equipo" section="equipment" options={equipmentTypes} selectedValues={filters.equipmentTypeFilter} />
                        <FilterSection title="Marca" section="brand" options={brandOptions} selectedValues={filters.brandFilter} />
                        <FilterSection title="Estado" section="status" options={statusOptions} selectedValues={filters.statusFilter} />
                        <FilterSection title="Autorización" section="authorization" options={authorizationOptions} selectedValues={filters.authorizationStatus} />
                </div>div>
          </div>div>
        );
};

export default EquipmentSearchFilters;</div>
