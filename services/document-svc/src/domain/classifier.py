"""Clasificador documental heurístico.

En producción se sustituye por un modelo LLM con few-shot examples.
Aquí implementamos una baseline determinista basada en palabras clave
por tipo de documento — sirve como fallback y como oracle para tests.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .document import DocumentType


@dataclass(frozen=True)
class ClassificationResult:
    document_type: DocumentType
    confidence: float
    matched_terms: list[str]


# Palabras clave por tipo (en español y con sinónimos regulatorios)
# Se puntúa por número de coincidencias únicas de términos.
_KEYWORDS: dict[DocumentType, list[str]] = {
    DocumentType.DT001_INSTRUMENT_CALIBRATION_CERT: [
        r"certificado.*calibraci[oó]n",
        r"laboratorio.*calibraci[oó]n",
        r"trazabilidad.*metrol[oó]gica",
        r"c[aá]mara.*ionizaci[oó]n",
        r"contamin[oó]metro",
        r"activ[ií]metro",
        r"pr[oó]xima.*calibraci[oó]n",
    ],
    DocumentType.DT002_MONTHLY_DOSIMETRY_REPORT: [
        r"informe.*dosim[eé]tric[oa]",
        r"lectura.*dosim[eé]trica",
        r"reporte.*dosim[eé]trico",
        r"hp\s*\(?10\)?",
        r"hp\s*\(?0\.07\)?",
        r"per[ií]odo.*mes",
        r"landauer|mirion|instadose|dosepro|ird",
    ],
    DocumentType.DT003_OPERATION_AUTHORIZATION: [
        r"autorizaci[oó]n.*operaci[oó]n",
        r"seremi.*salud",
        r"ds\s*133",
        r"operador.*equipo",
        r"resoluci[oó]n\s+exenta",
        r"autorizaci[oó]n.*sanitaria",
    ],
    DocumentType.DT004_FACILITY_LICENSE: [
        r"licencia.*instalaci[oó]n",
        r"instalaci[oó]n.*radiactiva",
        r"c[oó]digo\s+sanitario",
        r"servicio.*radioterapia|medicina\s+nuclear",
    ],
    DocumentType.DT005_SHIELDING_BLUEPRINT: [
        r"plano.*blindaje",
        r"espesor.*plomo|hormig[oó]n|baritado",
        r"muro|pared|puerta|techo",
        r"planta.*arquitect[oó]nica",
    ],
    DocumentType.DT006_SHIELDING_CALCULATION: [
        r"memoria.*c[aá]lculo",
        r"c[aá]lculo.*blindaje",
        r"carga.*trabajo",
        r"factor.*uso",
        r"factor.*ocupaci[oó]n",
        r"ncrp",
    ],
    DocumentType.DT007_TRAINING_CERTIFICATE: [
        r"certificado.*capacitaci[oó]n|curso",
        r"protecci[oó]n.*radiol[oó]gica",
        r"horas\s+acad[eé]micas",
        r"aprobado",
    ],
    DocumentType.DT008_MEDICAL_EXAM: [
        r"examen.*ocupacional",
        r"aptitud.*laboral",
        r"aptitud.*medica",
        r"informe\s+m[eé]dico",
        r"hemograma|orina|electrocardiograma",
    ],
    DocumentType.DT009_INCIDENT_REPORT: [
        r"informe.*incidente",
        r"reporte.*incidente",
        r"suceso\s+radiol[oó]gico",
        r"exposici[oó]n\s+inesperada",
        r"ines",
    ],
    DocumentType.DT010_EQUIPMENT_QA_REPORT: [
        r"control.*calidad",
        r"qa|quality\s+assurance",
        r"linac|acelerador",
        r"tc|ct|scanner",
        r"prueba\s+de\s+aceptaci[oó]n",
    ],
    DocumentType.DT011_SOURCE_CERTIFICATE: [
        r"certificado.*fuente",
        r"actividad.*bq|becquerel|ci|curie",
        r"is[oó]topo",
        r"ir-192|co-60|cs-137|i-131|f-18|tc-99",
    ],
    DocumentType.DT012_RADIOPHARMACEUTICAL_INVOICE: [
        r"radiof[aá]rmaco",
        r"gu[ií]a\s+de\s+despacho",
        r"factura.*radiof[aá]rmaco",
        r"calibraci[oó]n\s+datetime|fecha.*calibraci[oó]n",
    ],
    DocumentType.DT013_REGULATORY_INSPECTION_ACT: [
        r"acta.*inspecci[oó]n",
        r"fiscalizaci[oó]n",
        r"hallazgos",
        r"observaciones",
        r"seremi|isp",
    ],
    DocumentType.DT014_EQUIPMENT_MANUAL: [
        r"manual\s+de\s+usuario",
        r"manual\s+de\s+servicio",
        r"firmware",
        r"revisi[oó]n\s+preventiva",
    ],
    DocumentType.DT015_VENDOR_CONTRACT: [
        r"contrato",
        r"prestaci[oó]n\s+de\s+servicios",
        r"cl[aá]usula",
        r"proveedor|contratista",
    ],
}


def classify_by_keywords(text: str) -> ClassificationResult:
    """Clasifica por conteo de palabras clave normalizado."""
    if not text or not text.strip():
        return ClassificationResult(DocumentType.UNKNOWN, 0.0, [])

    text_lower = text.lower()
    scores: dict[DocumentType, tuple[int, list[str]]] = {}

    for doc_type, patterns in _KEYWORDS.items():
        matched = []
        for pat in patterns:
            if re.search(pat, text_lower):
                matched.append(pat)
        if matched:
            scores[doc_type] = (len(matched), matched)

    if not scores:
        return ClassificationResult(DocumentType.UNKNOWN, 0.0, [])

    # Ordenar por número de matches, mayor primero
    ranked = sorted(scores.items(), key=lambda x: x[1][0], reverse=True)
    best_type, (best_count, best_terms) = ranked[0]

    # Confianza:
    # - 100% si hay al menos 3 matches y el 2do lugar tiene ≤ mitad
    # - Escalada por número de coincidencias
    total_patterns = len(_KEYWORDS[best_type])
    ratio = best_count / total_patterns
    confidence = min(1.0, ratio + 0.15 * (best_count - 1))
    if len(ranked) >= 2:
        runner_up_count = ranked[1][1][0]
        # Si otro tipo casi empata, bajamos confianza
        if runner_up_count >= best_count * 0.75:
            confidence *= 0.7

    return ClassificationResult(
        document_type=best_type,
        confidence=round(confidence, 3),
        matched_terms=best_terms,
    )
