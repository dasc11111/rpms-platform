"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Users,
  Wrench,
  AlertTriangle,
  FileText,
  Syringe,
  ShieldCheck,
  Radio,
  ArrowRight,
  Loader2,
  SearchX,
} from "lucide-react";

type ResultType = "worker" | "instrument" | "incident" | "document" | "i131" | "compliance" | "source";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
}

const TYPE_META: Record<
  ResultType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  worker: { label: "Trabajador", icon: Users, color: "bg-blue-100 text-blue-700" },
  instrument: { label: "Instrumento", icon: Wrench, color: "bg-purple-100 text-purple-700" },
  incident: { label: "Incidente", icon: AlertTriangle, color: "bg-red-100 text-red-700" },
  document: { label: "Documento", icon: FileText, color: "bg-gray-100 text-gray-700" },
  i131: { label: "I-131", icon: Syringe, color: "bg-green-100 text-green-700" },
  compliance: { label: "Cumplimiento", icon: ShieldCheck, color: "bg-orange-100 text-orange-700" },
  source: { label: "Fuente", icon: Radio, color: "bg-yellow-100 text-yellow-700" },
};

const SUGGESTIONS = [
  "dosimetría anual",
  "calibración instrumento",
  "incidente INES",
  "DS 3/1985",
  "plan emergencia",
  "cumplimiento NS-06",
];

function ResultCard({ result }: { result: SearchResult }) {
  const meta = TYPE_META[result.type] ?? TYPE_META.document;
  const Icon = meta.icon;

  return (
    <Link
      href={result.href}
      className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition"
    >
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.color}`}>
            {meta.label}
          </span>
          {result.meta && (
            <span className="text-xs text-gray-400">{result.meta}</span>
          )}
        </div>
        <p className="mt-1 font-medium text-gray-900 group-hover:text-blue-700 transition">
          {result.title}
        </p>
        {result.subtitle && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{result.subtitle}</p>
        )}
      </div>
      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-gray-300 group-hover:text-blue-400 transition" />
    </Link>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [displayQuery, setDisplayQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      setResults(json.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load from URL param
  useEffect(() => {
    if (initialQ && initialQ.length >= 2) {
      doSearch(initialQ);
    }
    inputRef.current?.focus();
  }, [initialQ, doSearch]);

  const handleChange = (val: string) => {
    setDisplayQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val);
      doSearch(val);
      // Update URL without reload
      const url = val.trim() ? `/search?q=${encodeURIComponent(val.trim())}` : "/search";
      router.replace(url, { scroll: false });
    }, 350);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(displayQuery);
  };

  // Group results by type
  const groups = new Map<ResultType, SearchResult[]>();
  for (const r of results) {
    if (!groups.has(r.type)) groups.set(r.type, []);
    groups.get(r.type)!.push(r);
  }

  const totalTypes = groups.size;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="h-6 w-6 text-blue-500" />
          Búsqueda Global
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Busca en trabajadores, instrumentos, incidentes, documentos, cumplimiento y más
        </p>
      </div>

      {/* Search box */}
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={displayQuery}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Buscar trabajador, instrumento, incidente, documento…"
          className="w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 py-3.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 animate-spin" />
        )}
      </form>

      {/* Suggestions (when empty) */}
      {!searched && !loading && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Búsquedas frecuentes
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setDisplayQuery(s);
                  handleChange(s);
                }}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && !loading && results.length === 0 && (
        <div className="text-center py-12">
          <SearchX className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="font-medium text-gray-500">Sin resultados para "{query}"</p>
          <p className="text-sm text-gray-400 mt-1">
            Intenta con otro término o revisa la ortografía.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="text-sm text-gray-500">
            {results.length} resultado{results.length !== 1 ? "s" : ""} en {totalTypes} módulo{totalTypes !== 1 ? "s" : ""}
            {query && ` para "${query}"`}
          </div>

          <div className="space-y-6">
            {Array.from(groups.entries()).map(([type, typeResults]) => {
              const meta = TYPE_META[type] ?? TYPE_META.document;
              const Icon = meta.icon;
              return (
                <section key={type}>
                  <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}s ({typeResults.length})
                  </h2>
                  <div className="space-y-2">
                    {typeResults.map((r) => (
                      <ResultCard key={r.id} result={r} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* Module links */}
      {!searched && !loading && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Acceso directo a módulos
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(TYPE_META).map(([type, meta]) => {
              const Icon = meta.icon;
              const href =
                type === "worker" ? "/workers"
                : type === "instrument" ? "/instruments"
                : type === "incident" ? "/incidents"
                : type === "document" ? "/documents"
                : type === "i131" ? "/i131"
                : type === "compliance" ? "/compliance"
                : "/sources";
              return (
                <Link
                  key={type}
                  href={href}
                  className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-3 hover:border-blue-200 hover:shadow-sm transition"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md ${meta.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium text-gray-700">{meta.label}s</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
