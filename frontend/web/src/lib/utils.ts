import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMSv(v: number, digits = 2): string {
  return `${v.toFixed(digits)} mSv`;
}

export function formatDate(iso: string, locale = "es-CL"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function daysUntil(iso: string, from: Date = new Date()): number {
  const target = new Date(iso).getTime();
  const now = from.getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}
