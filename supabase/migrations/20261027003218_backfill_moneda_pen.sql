-- Normaliza a PEN (soles) las filas creadas con el default anterior 'MXN'.
-- Idempotente y seguro de re-ejecutar: solo toca filas marcadas 'MXN'.
update public.productos
  set moneda = 'PEN'
  where moneda = 'MXN';
