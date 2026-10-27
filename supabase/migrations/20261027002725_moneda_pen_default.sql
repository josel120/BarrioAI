-- Moneda por defecto: PEN (soles) para BarrioAI Perú.
alter table public.productos
  alter column moneda set default 'PEN';
