"use client";

/**
 * MODULO 4 - PET/CT - FASE Q
 * Visualizador de PDF embebido (seccion 32 del prompt de mejora). Permite
 * revisar un documento PDF (informe generado en la Fase P, o evidencia
 * grafica de tipo PDF registrada en la Fase J) directamente dentro de la
 * aplicacion, sin descargarlo primero. Se apoya en el visor nativo de PDF
 * del navegador (elemento <iframe>) para evitar dependencias adicionales
 * de renderizado y sus riesgos de compilacion; si el navegador no tiene
 * visor de PDF disponible, se ofrece igualmente el enlace directo al
 * archivo como alternativa.
 */

export default function PetCtPdfViewer({ fileUrl, title }: { fileUrl: string; title?: string }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b">
        <span className="text-xs font-medium text-slate-700 truncate">{title ?? "Documento PDF"}</span>
        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline whitespace-nowrap">
          Abrir en pestana nueva
        </a>
      </div>
      <iframe src={fileUrl} title={title ?? "Documento PDF"} className="w-full h-[600px] bg-white" />
      <p className="text-[11px] text-gray-500 px-3 py-1 border-t bg-slate-50">
        Si el documento no se muestra correctamente, use "Abrir en pestana nueva" para verlo con el
        visor de PDF del navegador o descargarlo.
      </p>
    </div>
  );
}
