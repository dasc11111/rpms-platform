import { sql } from "@/lib/db";

let ensured = false;

export async function ensureRadioterapiaTables() {
    if (ensured) return;

  await sql`
      CREATE TABLE IF NOT EXISTS rt_facilities (
            id SERIAL PRIMARY KEY,
                  name TEXT NOT NULL,
                        address TEXT,
                              responsible_qa TEXT,
                                    description TEXT,
                                          status TEXT NOT NULL DEFAULT 'activo',
                                                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                          );
                                                            `;

  await sql`
      CREATE TABLE IF NOT EXISTS rt_bunkers (
            id SERIAL PRIMARY KEY,
                  facility_id INTEGER REFERENCES rt_facilities(id) ON DELETE CASCADE,
                        linac_id INTEGER REFERENCES linac_units(id) ON DELETE SET NULL,
                              name TEXT NOT NULL,
                                    design_reference TEXT,
                                          status TEXT NOT NULL DEFAULT 'activo',
                                                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                          );
                                                            `;

  await sql`
      CREATE TABLE IF NOT EXISTS rt_shielding (
            id SERIAL PRIMARY KEY,
                  bunker_id INTEGER REFERENCES rt_bunkers(id) ON DELETE CASCADE,
                        element TEXT NOT NULL,
                              material TEXT,
                                    thickness_cm NUMERIC,
                                          calculation_reference TEXT,
                                                verification_date DATE,
                                                      status TEXT NOT NULL DEFAULT 'conforme',
                                                            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                );
                                                                  `;
  
