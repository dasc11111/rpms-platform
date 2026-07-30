// Main Equipment Management Components
export { default as EquipmentApp } from './equipment-app';
export type { Equipment, EquipmentStatus, AuthorizationStatus, Document, EquipmentHistory, TubeChange, ArchitectureChange, EquipmentLoan } from './equipment-app';

// Equipment List Component
export { default as EquipmentList } from './equipment-list';
export type { EquipmentListProps } from './equipment-list';

// Equipment Detail Modal
export { default as EquipmentDetailModal } from './equipment-detail-modal';
export type { EquipmentDetailModalProps } from './equipment-detail-modal';

// Search & Filters
export { default as EquipmentSearchFilters } from './equipment-search-filters';
export type { FilterState, SearchFiltersProps } from './equipment-search-filters';

// Alerts Panel
export { default as EquipmentAlertsPanel } from './equipment-alerts-panel';
export type { Alert, AlertsPanelProps } from './equipment-alerts-panel';

// Equipment Management System
// This module provides a complete radiological equipment management solution with:
// - Equipment CRUD operations
// - Document management (upload, download, preview)
// - Tube change tracking
// - Architecture change management
// - Equipment loan tracking
// - SEREMI authorization workflow
// - Automatic alerts and notifications
// - Complete audit trail
// - Advanced search and filtering
// - Dashboard integration
