-- =====================================================================
-- Data warehouse · datos históricos de demostración (OPCIONAL)
-- =====================================================================
-- Crea la empresa "Eventos Históricos (demo)" con ~3 años de actividad creíble (2024 → 2026)
-- en las tablas del SISTEMA (public.*), para que el warehouse tenga volumen y tendencias:
-- temporadas (egresados a fin de año, bienvenidas en marzo), inflación en los precios,
-- propuestas rechazadas con su motivo, cancelaciones, tareas, cambios e invitados.
--
-- - Es una empresa aparte: no toca los datos de las otras. Nadie entra al sistema con ella.
-- - Es reproducible (setseed): siempre genera los mismos datos.
-- - Si la empresa ya existe, no hace nada. Para sacarla: borrar-datos-historicos.sql
-- Después de cargarla: CALL dw.cargar();

DO $$
DECLARE
  hoy        CONSTANT DATE := CURRENT_DATE;
  emp        INT;
  usr        INT;
  tipos      INT[];
  t_nombre   TEXT[] := ARRAY['Fiesta de egresados', 'Fiesta de bienvenida', 'Aniversario', 'Baile de primavera'];
  sedes      INT[];
  caps       INT[] := ARRAY[150, 300, 500];
  serv       INT[];
  s_nombre   TEXT[] := ARRAY['Alquiler de salón', 'Catering', 'Sonido e iluminación', 'Decoración', 'Fotografía', 'Barra sin alcohol'];
  s_precio   NUMERIC[] := ARRAY[480000, 7200, 190000, 95000, 130000, 3800];   -- lista actual (nov. 2026)
  clientes   INT[] := '{}';
  contactos  INT[] := '{}';
  inst       TEXT[] := ARRAY['Colegio Belgrano', 'Instituto San Martín', 'Escuela Normal Alberdi', 'Colegio Nacional de Monserrat',
                             'Instituto Leibnitz', 'Colegio Santo Tomás', 'IPEM 270', 'Escuela Manuel Belgrano', 'Colegio Alemán',
                             'Instituto Domingo Zípoli', 'Colegio Taborin', 'ENET 1', 'Colegio del Carmen', 'Instituto Jesús María',
                             'Colegio Garbino', 'Escuela Olmos', 'Colegio La Salle', 'Instituto Cervantes', 'Colegio Mark Twain',
                             'Escuela Carbó', 'IPET 66', 'Colegio Nuestra Señora', 'Instituto Pascal', 'Colegio Dante Alighieri'];
  nombres    TEXT[] := ARRAY['Martina', 'Lucía', 'Sofía', 'Valentina', 'Camila', 'Julieta', 'Agustina', 'Delfina', 'Mateo', 'Santiago',
                             'Benjamín', 'Tomás', 'Joaquín', 'Facundo', 'Lautaro', 'Franco', 'Bautista', 'Ignacio', 'Pilar', 'Morena'];
  apellidos  TEXT[] := ARRAY['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Pérez', 'Gómez', 'Díaz', 'Sánchez', 'Romero',
                             'Sosa', 'Torres', 'Álvarez', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera'];
  motivos    TEXT[] := ARRAY['Les pareció caro', 'Eligieron otra organizadora', 'Cambiaron la fecha y no teníamos lugar',
                             'No consiguieron juntar a todo el curso', 'Lo resolvieron por su cuenta'];
  provs      INT[];
  -- variables del evento
  i INT; k INT; n INT; tipo INT; anio INT; mes INT; dia INT;
  f DATE; creado DATE; presentado TIMESTAMP; respondido TIMESTAMP;
  cant INT; sede_i INT; cli INT; ev INT; prop INT; inv INT; precio_inv NUMERIC;
  factor NUMERIC; acepta BOOLEAN; estado_ev TEXT; estado_prop TEXT; subtotal NUMERIC; desc_ NUMERIC;
  p NUMERIC; prov INT; propio BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM empresas WHERE nombre = 'Eventos Históricos (demo)') THEN
    RAISE NOTICE 'La empresa "Eventos Históricos (demo)" ya existe: no se genera nada.';
    RETURN;
  END IF;
  PERFORM setseed(0.42);

  INSERT INTO empresas (nombre, email, telefono, direccion, fecha_creacion)
  VALUES ('Eventos Históricos (demo)', NULL, NULL, 'Córdoba', TIMESTAMP '2023-11-15 10:00')
  RETURNING id_empresa INTO emp;
  INSERT INTO usuarios (id_empresa, nombre, recorrido_visto, primeros_pasos_cerrado)
  VALUES (emp, 'Equipo de organización', TRUE, TRUE) RETURNING id_usuario INTO usr;

  -- Catálogos
  FOR k IN 1..4 LOOP
    INSERT INTO tipos_evento (id_empresa, nombre) VALUES (emp, t_nombre[k]) RETURNING id_tipo_evento INTO n;
    tipos := tipos || n;
  END LOOP;
  FOR k IN 1..3 LOOP
    INSERT INTO sedes (id_empresa, nombre, direccion, capacidad)
    VALUES (emp, (ARRAY['Salón Los Álamos', 'Quinta La Arboleda', 'Complejo Río Suquía'])[k], 'Córdoba', caps[k])
    RETURNING id_sede INTO n;
    sedes := sedes || n;
  END LOOP;
  FOR k IN 1..6 LOOP
    INSERT INTO servicios (id_empresa, nombre, precio_referencia) VALUES (emp, s_nombre[k], s_precio[k])
    RETURNING id_servicio INTO n;
    serv := serv || n;
  END LOOP;
  -- Proveedores: [catering ×2, sonido ×2, deco+foto, barra]
  FOR k IN 1..6 LOOP
    INSERT INTO proveedores (id_empresa, nombre, contacto_nombre, telefono)
    VALUES (emp, (ARRAY['Catering Sabores', 'Delicias del Centro', 'Sonido Total', 'DJ Nacho Producciones',
                        'Foto y Deco Studio', 'Barra Móvil Córdoba'])[k],
            nombres[1 + floor(random() * 20)::int], '351-' || (4000000 + floor(random() * 999999)::int))
    RETURNING id_proveedor INTO n;
    provs := provs || n;
  END LOOP;
  INSERT INTO proveedor_servicios VALUES
    (provs[1], serv[2]), (provs[2], serv[2]), (provs[3], serv[3]), (provs[4], serv[3]),
    (provs[5], serv[4]), (provs[5], serv[5]), (provs[6], serv[6]);

  -- Clientes: un centro de estudiantes por institución, con su contacto vigente
  FOR k IN 1..array_length(inst, 1) LOOP
    INSERT INTO clientes (id_empresa, nombre, tipo, institucion)
    VALUES (emp, 'Centro de Estudiantes ' || inst[k], CASE WHEN k % 7 = 0 THEN 'curso' ELSE 'centro_estudiantes' END, inst[k])
    RETURNING id_cliente INTO n;
    clientes := clientes || n;
    INSERT INTO contactos (id_cliente, nombre, telefono, rol, vigente)
    VALUES (n, nombres[1 + floor(random() * 20)::int] || ' ' || apellidos[1 + floor(random() * 20)::int],
            '351-' || (5000000 + floor(random() * 999999)::int), 'Presidencia del centro', TRUE)
    RETURNING id_contacto INTO n;
    contactos := contactos || n;
  END LOOP;

  -- Eventos
  FOR i IN 1..420 LOOP
    -- tipo: egresados 40 %, bienvenida 30 %, aniversario 20 %, primavera 10 %
    p := random();
    tipo := CASE WHEN p < 0.40 THEN 1 WHEN p < 0.70 THEN 2 WHEN p < 0.90 THEN 3 ELSE 4 END;
    -- el negocio crece: 2024 27 %, 2025 38 %, 2026 35 %
    p := random();
    anio := CASE WHEN p < 0.27 THEN 2024 WHEN p < 0.65 THEN 2025 ELSE 2026 END;
    -- temporada de cada tipo
    mes := CASE tipo
      WHEN 1 THEN (ARRAY[7, 10, 11, 11, 12, 12, 12, 11, 10, 12])[1 + floor(random() * 10)::int]
      WHEN 2 THEN (ARRAY[3, 3, 3, 4, 4, 2])[1 + floor(random() * 6)::int]
      WHEN 3 THEN 1 + floor(random() * 12)::int
      ELSE 9 END;
    dia := 1 + floor(random() * 28)::int;
    f := make_date(anio, mes, dia);
    f := f + ((5 - EXTRACT(ISODOW FROM f)::int + 7) % 7) + CASE WHEN random() < 0.6 THEN 1 ELSE 0 END;  -- viernes o sábado
    CONTINUE WHEN f > DATE '2026-12-31';

    cant := CASE tipo WHEN 1 THEN 80 + floor(random() * 220)::int WHEN 2 THEN 120 + floor(random() * 280)::int
                      WHEN 3 THEN 150 + floor(random() * 350)::int ELSE 80 + floor(random() * 170)::int END;
    sede_i := CASE WHEN random() < 0.08 THEN NULL WHEN cant <= 150 THEN 1 WHEN cant <= 300 THEN 2 ELSE 3 END;
    k := 1 + floor(random() * array_length(clientes, 1))::int;
    cli := clientes[k];
    creado := f - (20 + floor(random() * 130)::int);
    IF creado > hoy THEN creado := hoy - floor(random() * 10)::int; END IF;
    -- inflación: los precios eran ~2,5 % más baratos por cada mes hacia atrás
    factor := power(1.025, -GREATEST(0, (DATE_PART('year', age(DATE '2026-11-01', date_trunc('month', creado)::date)) * 12
                                        + DATE_PART('month', age(DATE '2026-11-01', date_trunc('month', creado)::date)))::int));

    presentado := (creado + 1 + floor(random() * 7)::int) + TIME '10:00' + random() * INTERVAL '8 hours';
    respondido := presentado + (1 + floor(random() * 20)::int) * INTERVAL '1 day';
    acepta := random() < CASE tipo WHEN 1 THEN 0.72 WHEN 2 THEN 0.62 WHEN 3 THEN 0.55 ELSE 0.58 END;

    IF presentado::date > hoy OR random() < 0.03 THEN
      estado_ev := CASE WHEN random() < 0.75 THEN 'recibida' ELSE 'falta_informacion' END; estado_prop := NULL;
    ELSIF respondido::date > hoy THEN
      estado_ev := 'propuesta_enviada';
      estado_prop := CASE WHEN presentado::date + 15 < hoy THEN 'vencida' ELSE 'presentada' END;
      respondido := NULL;
    ELSIF acepta THEN
      estado_prop := 'aceptada';
      estado_ev := CASE WHEN f < hoy THEN (CASE WHEN random() < 0.05 THEN 'cancelado' ELSE 'realizado' END)
                        WHEN f - hoy <= 30 THEN 'en_preparacion' ELSE 'confirmado' END;
    ELSE
      estado_prop := 'rechazada'; estado_ev := 'no_aceptada';
    END IF;

    INSERT INTO eventos (id_empresa, id_cliente, id_contacto, id_tipo_evento, id_sede, nombre, fecha, hora_inicio,
                         cantidad_estimada, estado, motivo_cancelacion, observaciones_cierre, fecha_creacion)
    VALUES (emp, cli, contactos[k], tipos[tipo], sedes[sede_i],
            t_nombre[tipo] || ' ' || inst[k] || ' ' || EXTRACT(YEAR FROM f),
            f, TIME '21:00', cant, estado_ev,
            CASE WHEN estado_ev = 'cancelado' THEN 'El colegio suspendió la fiesta' END,
            CASE WHEN estado_ev = 'realizado' THEN 'Sin inconvenientes' END,
            creado + TIME '11:00')
    RETURNING id_evento INTO ev;

    CONTINUE WHEN estado_prop IS NULL;

    INSERT INTO propuestas (id_empresa, id_evento, estado, descuento, motivo_rechazo, fecha_presentacion, fecha_respuesta)
    VALUES (emp, ev, estado_prop, 0,
            CASE WHEN estado_prop = 'rechazada' THEN motivos[1 + floor(random() * 5)::int] END,
            presentado, respondido)
    RETURNING id_propuesta INTO prop;

    -- Ítems: salón (si hay sede), catering y sonido siempre; el resto a veces
    FOR k IN 1..6 LOOP
      CONTINUE WHEN (k = 1 AND sede_i IS NULL) OR (k = 4 AND random() > 0.7)
                 OR (k = 5 AND random() > 0.6) OR (k = 6 AND random() > 0.4);
      n := CASE WHEN k IN (2, 6) THEN cant ELSE 1 END;
      p := round(s_precio[k] * factor * (0.95 + random() * 0.15) / 100) * 100;
      IF k IN (2, 6) THEN p := round(s_precio[k] * factor * (0.95 + random() * 0.15) / 10) * 10; END IF;
      INSERT INTO propuesta_items (id_propuesta, id_servicio, cantidad, precio_unitario) VALUES (prop, serv[k], n, p);
      -- Servicio vendido: quién lo resuelve
      IF estado_prop = 'aceptada' THEN
        prov := CASE k WHEN 2 THEN provs[1 + floor(random() * 2)::int] WHEN 3 THEN provs[3 + floor(random() * 2)::int]
                       WHEN 4 THEN provs[5] WHEN 5 THEN provs[5] WHEN 6 THEN provs[6] END;
        propio := k = 1 OR (k = 4 AND random() < 0.4);   -- el salón y parte de la decoración, con equipo propio
        INSERT INTO evento_servicios (id_evento, id_servicio, es_propio, id_proveedor, id_responsable, estado)
        VALUES (ev, serv[k], propio, CASE WHEN propio THEN NULL ELSE prov END, usr,
                CASE WHEN f < hoy OR random() < 0.6 THEN 'confirmado' ELSE 'pendiente' END);
      END IF;
    END LOOP;

    -- Descuento en ~30 % de las propuestas
    IF random() < 0.3 THEN
      SELECT SUM(cantidad * precio_unitario) INTO subtotal FROM propuesta_items WHERE id_propuesta = prop;
      desc_ := round(subtotal * (0.05 + random() * 0.05) / 1000) * 1000;
      UPDATE propuestas SET descuento = desc_ WHERE id_propuesta = prop;
    END IF;

    CONTINUE WHEN estado_prop <> 'aceptada';

    -- Tareas de organización
    FOR k IN 1..(3 + floor(random() * 3)::int) LOOP
      INSERT INTO tareas (id_empresa, id_evento, id_responsable, descripcion, fecha_prevista, estado)
      VALUES (emp, ev, usr,
              (ARRAY['Confirmar lista de música', 'Visitar el salón con el centro', 'Coordinar armado',
                     'Pasar el menú al catering', 'Revisar seguridad y ambulancia'])[k],
              f - floor(random() * 25)::int,
              CASE WHEN f < hoy THEN (CASE WHEN random() < 0.92 THEN 'hecha' ELSE 'pendiente' END)
                   WHEN random() < 0.3 THEN 'en_curso' ELSE 'pendiente' END);
    END LOOP;

    -- Cambios pedidos por el centro (~20 %)
    IF random() < 0.2 THEN
      INSERT INTO cambios_evento (id_evento, id_usuario, fecha, descripcion, valor_anterior, valor_nuevo)
      VALUES (ev, usr, LEAST(respondido + INTERVAL '5 days', hoy::timestamp), 'Cambio de cantidad estimada',
              (cant - 20)::text, cant::text);
    END IF;

    -- Invitados (la función existe desde mediados de 2025)
    IF f >= DATE '2025-06-01' AND estado_ev <> 'cancelado' AND random() < 0.75 THEN
      precio_inv := round((18000 + random() * 22000) * factor / 500) * 500;
      INSERT INTO invitaciones (id_empresa, id_evento, token, precio_por_invitado, fecha_limite, fecha_creacion)
      VALUES (emp, ev, md5(random()::text || ev), precio_inv, f - 7, respondido + INTERVAL '2 days')
      RETURNING id_invitacion INTO inv;
      FOR k IN 1..floor(cant * (0.3 + random() * 0.4))::int LOOP
        p := random();
        INSERT INTO invitados (id_invitacion, nombre, apellido, asiste, medio_pago, pago_verificado, fecha_respuesta)
        VALUES (inv, nombres[1 + floor(random() * 20)::int], apellidos[1 + floor(random() * 20)::int],
                p < 0.82,
                CASE WHEN p < 0.82 THEN (CASE WHEN random() < 0.55 THEN 'transferencia' ELSE 'efectivo' END) END,
                p < 0.82 AND random() < CASE WHEN f < hoy THEN 0.93 ELSE 0.5 END,
                LEAST(respondido + INTERVAL '3 days' + random() * GREATEST(f - respondido::date, 0) * INTERVAL '1 day', hoy::timestamp));
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Listo: % eventos de "Eventos Históricos (demo)"', (SELECT COUNT(*) FROM eventos WHERE id_empresa = emp);
END $$;
