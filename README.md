# BarrioAI

Mobile-First PWA that digitalizes local commerce in one photo.

A merchant photographs a physical menu/chalkboard. BarrioAI uses
**Llama 3.2 Vision** to extract structured products, stores them with
**PostGIS** geolocation and **pgvector** embeddings in Supabase, and
makes them instantly discoverable via semantic localized search.

## Stack

TypeScript · Next.js App Router · TailwindCSS · Supabase (PostgreSQL + PostGIS + pgvector) · Llama 3.2 Vision

## Core Flow

Photo + HTML5 Geolocation → /api/upload → Llama 3.2 Vision (strict JSON) → Zod validation → Batch embeddings → Supabase upsert

## Run Locally

npm install
cp .env.local.example .env.local # fill in keys
npm run dev
