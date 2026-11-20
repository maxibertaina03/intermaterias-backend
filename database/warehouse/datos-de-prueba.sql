-- =====================================================================
-- Datos de prueba: 6 meses de trabajo de "Eventos del Centro"
-- =====================================================================
-- Se corre en la base OPERATIVA (eventos). Simula lo que habría cargado la organizadora en los
-- últimos 6 meses: unos 16 centros de estudiantes nuevos con sus contactos, ~95 solicitudes con
-- sus propuestas (aceptadas, rechazadas con motivo, vencidas, en espera), servicios asignados a
-- proveedores, tareas del equipo, cambios pedidos por los centros e invitados con sus pagos.
--
-- - Va en la empresa "Eventos del Centro": se ve en el sistema entrando con sofia, masita, etc.
-- - Usa los catálogos de esa empresa y suma un salón, un servicio y 4 proveedores.
-- - Las fechas son relativas a HOY: las solicitudes van de hace 6 meses a hoy y los eventos,
--   del mes que viene en adelante o ya realizados, según el caso.
-- - Es reproducible (setseed). Si ya se cargó, no hace nada. Para sacarlo: borrar-datos-de-prueba.sql
-- Después, en eventos_dw: CALL cargar_dw();

DO $$
DECLARE
  hoy       CONSTANT DATE := CURRENT_DATE;
  desde     CONSTANT DATE := CURRENT_DATE - 182;            -- hace 6 meses
  emp       INT;
  inst      TEXT[] := ARRAY['Colegio Taborin', 'Instituto Leibnitz', 'Escuela Normal Alberdi', 'Colegio Santo Tomás',
                            'IPEM 270', 'Colegio Alemán', 'Instituto Domingo Zípoli', 'ENET 1', 'Colegio del Carmen',
                            'Instituto Jesús María', 'Colegio Garbino', 'Colegio La Salle', 'Instituto Cervantes',
                            'Colegio Mark Twain', 'IPET 66', 'Colegio Dante Alighieri'];
  nombres   TEXT[] := ARRAY['Martina', 'Lucía', 'Sofía', 'Valentina', 'Camila', 'Julieta', 'Agustina', 'Delfina', 'Mateo',
                            'Santiago', 'Benjamín', 'Tomás', 'Joaquín', 'Facundo', 'Lautaro', 'Franco', 'Bautista',
                            'Ignacio', 'Pilar', 'Morena'];
  apellidos TEXT[] := ARRAY['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Pérez', 'Gómez', 'Díaz', 'Sánchez',
                            'Romero', 'Sosa', 'Torres', 'Álvarez', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez',
                            'Medina', 'Herrera'];
  motivos   TEXT[] := ARRAY['Les pareció caro', 'Eligieron otra organizadora', 'Cambiaron la fecha y no teníamos lugar',
                            'No consiguieron juntar a todo el curso', 'Lo resolvieron por su cuenta'];
  tareas_t  TEXT[] := ARRAY['Visitar el salón con el centro', 'Confirmar lista de música', 'Pasar el menú al catering',
                            'Coordinar armado y desarmado', 'Revisar seguridad y ambulancia', 'Mandar el link de invitados'];
  -- catálogos (ids de la empresa)
  t_egr INT; t_bien INT; t_aniv INT;
  sedes INT[]; caps INT[];
  s_salon INT; s_catering INT; s_sonido INT; s_deco INT; s_foto INT; s_barra INT;
  serv INT[]; precio NUMERIC[]; por_persona BOOLEAN[]; provs_de INT[][];
  atencion INT[]; organiza INT[]; equipo INT[];
  clientes INT[] := '{}'; contactos INT[] := '{}'; n_inst INT;
  -- evento
  i INT; k INT; n INT; tipo INT; f DATE; creado DATE; presentado TIMESTAMP; respondido TIMESTAMP;
  cant INT; sede_i INT; cli INT; ev INT; prop INT; inv INT; factor NUMERIC; acepta BOOLEAN;
  estado_ev TEXT; estado_prop TEXT; p NUMERIC; prov INT; propio BOOLEAN; sub NUMERIC; nombre_tipo TEXT;
BEGIN
  SELECT id_empresa INTO emp FROM empresas WHERE nombre = 'Eventos del Centro';
  IF emp IS NULL THEN RAISE EXCEPTION 'No existe la empresa "Eventos del Centro"'; END IF;
  IF EXISTS (SELECT 1 FROM clientes WHERE id_empresa = emp AND institucion = inst[1]) THEN
    RAISE NOTICE 'Los datos de prueba ya están cargados: no se hace nada.';
    RETURN;
  END IF;
  PERFORM setseed(0.26);

  -- ── Catálogos que ya tiene la empresa ───────────────────────────────
  SELECT id_tipo_evento INTO t_egr  FROM tipos_evento WHERE id_empresa = emp AND nombre = 'Fiesta de egresados';
  SELECT id_tipo_evento INTO t_bien FROM tipos_evento WHERE id_empresa = emp AND nombre = 'Fiesta de bienvenida';
  SELECT id_tipo_evento INTO t_aniv FROM tipos_evento WHERE id_empresa = emp AND nombre = 'Aniversario';
  SELECT id_servicio INTO s_salon    FROM servicios WHERE id_empresa = emp AND nombre = 'Alquiler de salón';
  SELECT id_servicio INTO s_catering FROM servicios WHERE id_empresa = emp AND nombre = 'Catering';
  SELECT id_servicio INTO s_sonido   FROM servicios WHERE id_empresa = emp AND nombre = 'Sonido e iluminación';
  SELECT id_servicio INTO s_deco     FROM servicios WHERE id_empresa = emp AND nombre = 'Decoración';
  SELECT id_servicio INTO s_foto     FROM servicios WHERE id_empresa = emp AND nombre = 'Fotografía';
  IF t_egr IS NULL OR t_bien IS NULL OR t_aniv IS NULL OR s_salon IS NULL OR s_catering IS NULL
     OR s_sonido IS NULL OR s_deco IS NULL OR s_foto IS NULL THEN
    RAISE EXCEPTION 'Faltan tipos de evento o servicios de ejemplo en "Eventos del Centro"';
  END IF;

  -- ── Lo que suma: un salón chico, la barra y proveedores ─────────────
  INSERT INTO sedes (id_empresa, nombre, direccion, capacidad)
  VALUES (emp, 'Quinta La Arboleda', 'Camino a Saldán km 3', 150);
  INSERT INTO servicios (id_empresa, nombre, descripcion, precio_referencia)
  VALUES (emp, 'Barra sin alcohol', 'Tragos sin alcohol y bartender, por persona', 3500)
  RETURNING id_servicio INTO s_barra;
  SELECT array_agg(id_sede ORDER BY capacidad), array_agg(capacidad ORDER BY capacidad)
    INTO sedes, caps FROM sedes WHERE id_empresa = emp;

  serv        := ARRAY[s_salon, s_catering, s_sonido, s_deco, s_foto, s_barra];
  precio      := ARRAY(SELECT precio_referencia FROM servicios s, unnest(serv) WITH ORDINALITY u(id, o)
                        WHERE s.id_servicio = u.id ORDER BY o);
  por_persona := ARRAY[FALSE, TRUE, FALSE, FALSE, FALSE, TRUE];

  INSERT INTO proveedores (id_empresa, nombre, contacto_nombre, telefono) VALUES
    (emp, 'Delicias del Centro', 'Laura', '351-4123456'),
    (emp, 'Sonido Total', 'Martín', '351-5987654'),
    (emp, 'Deco Studio', 'Carla', '351-6234567'),
    (emp, 'Barra Móvil Córdoba', 'Nico', '351-7345678');
  INSERT INTO proveedor_servicios
  SELECT p.id_proveedor, x.id_servicio
    FROM proveedores p
    JOIN (VALUES ('Delicias del Centro', s_catering), ('Sonido Total', s_sonido),
                 ('Deco Studio', s_deco), ('Barra Móvil Córdoba', s_barra)) x(nombre, id_servicio)
      ON x.nombre = p.nombre
   WHERE p.id_empresa = emp;

  -- ── El equipo (usuarios de la empresa, según su rol) ────────────────
  SELECT array_agg(DISTINCT u.id_usuario) INTO atencion FROM usuarios u JOIN usuario_roles r USING (id_usuario)
   WHERE u.id_empresa = emp AND r.rol IN ('atencion_cliente', 'admin_empresa');
  SELECT array_agg(DISTINCT u.id_usuario) INTO organiza FROM usuarios u JOIN usuario_roles r USING (id_usuario)
   WHERE u.id_empresa = emp AND r.rol = 'responsable_organizacion';
  SELECT array_agg(id_usuario) INTO equipo FROM usuarios WHERE id_empresa = emp AND activo;
  organiza := COALESCE(organiza, equipo); atencion := COALESCE(atencion, equipo);

  -- ── Clientes: 16 centros nuevos; a algunos les cambió la presidencia ─
  n_inst := array_length(inst, 1);
  FOR k IN 1..n_inst LOOP
    INSERT INTO clientes (id_empresa, nombre, tipo, institucion)
    VALUES (emp, 'Centro de Estudiantes ' || inst[k], CASE WHEN k % 6 = 0 THEN 'curso' ELSE 'centro_estudiantes' END, inst[k])
    RETURNING id_cliente INTO cli;
    clientes := clientes || cli;
    IF k % 4 = 0 THEN   -- contacto anterior, ya no vigente
      INSERT INTO contactos (id_cliente, nombre, telefono, rol, vigente)
      VALUES (cli, nombres[1 + floor(random() * 20)::int] || ' ' || apellidos[1 + floor(random() * 20)::int],
              '351-' || (5000000 + floor(random() * 999999)::int), 'Presidencia (gestión anterior)', FALSE);
    END IF;
    INSERT INTO contactos (id_cliente, nombre, telefono, email, rol, vigente)
    VALUES (cli, nombres[1 + floor(random() * 20)::int] || ' ' || apellidos[1 + floor(random() * 20)::int],
            '351-' || (5000000 + floor(random() * 999999)::int),
            'centro.' || lower(replace(replace(inst[k], ' ', ''), 'é', 'e')) || '@gmail.com',
            (ARRAY['Presidencia del centro', 'Secretaría', 'Delegada del curso'])[1 + floor(random() * 3)::int], TRUE)
    RETURNING id_contacto INTO n;
    contactos := contactos || n;
  END LOOP;

  -- ── Solicitudes de los últimos 6 meses ──────────────────────────────
  FOR i IN 1..95 LOOP
    creado := desde + floor(random() * 183)::int;
    p := random();
    tipo := CASE WHEN p < 0.45 THEN t_egr WHEN p < 0.75 THEN t_bien ELSE t_aniv END;
    -- fecha del evento según la temporada de cada tipo
    IF tipo = t_egr THEN          -- egresados: octubre a diciembre
      f := make_date(EXTRACT(YEAR FROM creado + 25)::int, 10 + floor(random() * 3)::int, 1 + floor(random() * 28)::int);
      IF f < creado + 25 THEN f := f + INTERVAL '1 year'; END IF;
    ELSIF tipo = t_bien THEN      -- bienvenida: marzo y abril
      f := make_date(EXTRACT(YEAR FROM creado)::int, 3 + floor(random() * 2)::int, 1 + floor(random() * 28)::int);
      IF f < creado + 25 THEN f := f + INTERVAL '1 year'; END IF;
    ELSE                          -- aniversario: cualquier momento
      f := creado + 30 + floor(random() * 100)::int;
    END IF;
    f := f + ((5 - EXTRACT(ISODOW FROM f)::int + 7) % 7) + CASE WHEN random() < 0.6 THEN 1 ELSE 0 END;  -- viernes o sábado

    nombre_tipo := (SELECT nombre FROM tipos_evento WHERE id_tipo_evento = tipo);
    cant := CASE WHEN tipo = t_egr THEN 60 + floor(random() * 180)::int
                 WHEN tipo = t_bien THEN 120 + floor(random() * 260)::int
                 ELSE 150 + floor(random() * 320)::int END;
    sede_i := NULL;
    IF random() > 0.08 THEN
      FOR k IN 1..array_length(sedes, 1) LOOP
        IF caps[k] >= cant THEN sede_i := k; EXIT; END IF;
      END LOOP;
      sede_i := COALESCE(sede_i, array_length(sedes, 1));
    END IF;
    k := 1 + floor(random() * n_inst)::int;
    -- inflación: ~2,5 % por mes
    factor := power(1.025, -((hoy - creado) / 30));

    presentado := (creado + 1 + floor(random() * 6)::int) + TIME '10:00' + random() * INTERVAL '8 hours';
    respondido := presentado + (2 + floor(random() * 15)::int) * INTERVAL '1 day';
    acepta := random() < CASE WHEN tipo = t_egr THEN 0.68 WHEN tipo = t_bien THEN 0.60 ELSE 0.52 END;

    IF presentado::date > hoy OR random() < 0.04 THEN
      estado_ev := CASE WHEN random() < 0.7 THEN 'recibida' ELSE 'falta_informacion' END; estado_prop := NULL;
    ELSIF respondido::date > hoy THEN
      estado_ev := 'propuesta_enviada';
      estado_prop := CASE WHEN presentado::date + 15 < hoy THEN 'vencida' ELSE 'presentada' END;
      respondido := NULL;
    ELSIF acepta THEN
      estado_prop := 'aceptada';
      estado_ev := CASE WHEN f < hoy THEN (CASE WHEN random() < 0.06 THEN 'cancelado' ELSE 'realizado' END)
                        WHEN f - hoy <= 30 THEN 'en_preparacion' ELSE 'confirmado' END;
    ELSE
      estado_prop := 'rechazada'; estado_ev := 'no_aceptada';
    END IF;

    INSERT INTO eventos (id_empresa, id_cliente, id_contacto, id_tipo_evento, id_sede, nombre, fecha, hora_inicio,
                         cantidad_estimada, necesidades, estado, motivo_cancelacion, observaciones_cierre, fecha_creacion)
    VALUES (emp, clientes[k], contactos[k], tipo, sedes[sede_i],
            nombre_tipo || ' ' || inst[k] || ' ' || EXTRACT(YEAR FROM f), f,
            (ARRAY[TIME '21:00', TIME '22:00', TIME '20:30'])[1 + floor(random() * 3)::int], cant,
            (ARRAY['Quieren DJ hasta las 5', 'Menú vegetariano para algunos chicos', 'Necesitan salón con estacionamiento',
                   NULL, NULL])[1 + floor(random() * 5)::int],
            estado_ev,
            CASE WHEN estado_ev = 'cancelado' THEN 'El colegio suspendió la fiesta' END,
            CASE WHEN estado_ev = 'realizado' THEN (ARRAY['Salió todo bien', 'Se atrasó el catering 30 minutos',
                                                           'Muy buena devolución del centro'])[1 + floor(random() * 3)::int] END,
            creado + TIME '11:00' + random() * INTERVAL '6 hours')
    RETURNING id_evento INTO ev;

    CONTINUE WHEN estado_prop IS NULL;

    INSERT INTO propuestas (id_empresa, id_evento, estado, descuento, condiciones, motivo_rechazo,
                            fecha_presentacion, fecha_respuesta)
    VALUES (emp, ev, estado_prop, 0, 'Seña del 30 % para reservar la fecha; saldo hasta 7 días antes.',
            CASE WHEN estado_prop = 'rechazada' THEN motivos[1 + floor(random() * 5)::int] END,
            presentado, respondido)
    RETURNING id_propuesta INTO prop;

    FOR k IN 1..6 LOOP
      CONTINUE WHEN (k = 1 AND sede_i IS NULL) OR (k = 4 AND random() > 0.7)
                 OR (k = 5 AND random() > 0.6) OR (k = 6 AND random() > 0.4);
      n := CASE WHEN por_persona[k] THEN cant ELSE 1 END;
      p := precio[k] * factor * (0.95 + random() * 0.12);
      p := CASE WHEN por_persona[k] THEN round(p / 10) * 10 ELSE round(p / 1000) * 1000 END;
      INSERT INTO propuesta_items (id_propuesta, id_servicio, cantidad, precio_unitario) VALUES (prop, serv[k], n, p);
      IF estado_prop = 'aceptada' THEN
        -- un proveedor que dé ese servicio, o el equipo propio
        SELECT id_proveedor INTO prov FROM proveedor_servicios WHERE id_servicio = serv[k]
         ORDER BY random() LIMIT 1;
        propio := prov IS NULL OR (k = 4 AND random() < 0.4);
        INSERT INTO evento_servicios (id_evento, id_servicio, es_propio, id_proveedor, id_responsable, estado, observaciones)
        VALUES (ev, serv[k], propio, CASE WHEN propio THEN NULL ELSE prov END,
                organiza[1 + floor(random() * array_length(organiza, 1))::int],
                CASE WHEN f < hoy OR f - hoy > 60 AND random() < 0.4 OR random() < 0.5 THEN 'confirmado' ELSE 'pendiente' END,
                CASE WHEN random() < 0.15 THEN 'Pidieron factura A' END);
      END IF;
    END LOOP;

    IF random() < 0.3 THEN   -- descuento del 5 al 10 %
      SELECT SUM(cantidad * precio_unitario) INTO sub FROM propuesta_items WHERE id_propuesta = prop;
      UPDATE propuestas SET descuento = round(sub * (0.05 + random() * 0.05) / 1000) * 1000 WHERE id_propuesta = prop;
    END IF;

    CONTINUE WHEN estado_prop <> 'aceptada';

    -- Tareas del equipo
    FOR k IN 1..(3 + floor(random() * 3)::int) LOOP
      INSERT INTO tareas (id_empresa, id_evento, id_responsable, descripcion, fecha_prevista, estado)
      VALUES (emp, ev, equipo[1 + floor(random() * array_length(equipo, 1))::int], tareas_t[k],
              f - (2 + floor(random() * 25)::int),
              CASE WHEN f < hoy THEN (CASE WHEN random() < 0.93 THEN 'hecha' ELSE 'pendiente' END)
                   WHEN random() < 0.25 THEN 'hecha' WHEN random() < 0.3 THEN 'en_curso' ELSE 'pendiente' END);
    END LOOP;

    -- Cambios pedidos por el centro (~25 %)
    IF random() < 0.25 AND respondido + INTERVAL '3 days' < hoy THEN
      INSERT INTO cambios_evento (id_evento, id_usuario, fecha, descripcion, valor_anterior, valor_nuevo)
      VALUES (ev, atencion[1 + floor(random() * array_length(atencion, 1))::int],
              respondido + (3 + floor(random() * 10)::int) * INTERVAL '1 day', 'Cantidad estimada',
              (cant - 10 - floor(random() * 30)::int)::text, cant::text);
    END IF;

    -- Invitados (~70 % de los eventos usa el link)
    IF estado_ev <> 'cancelado' AND random() < 0.7 AND respondido::date + 3 < hoy THEN
      INSERT INTO invitaciones (id_empresa, id_evento, token, precio_por_invitado, fecha_limite, fecha_creacion)
      VALUES (emp, ev, md5(random()::text || ev), round((20000 + random() * 20000) * factor / 500) * 500,
              f - 7, respondido + INTERVAL '2 days')
      RETURNING id_invitacion INTO inv;
      FOR k IN 1..floor(cant * CASE WHEN f < hoy THEN 0.5 + random() * 0.3 ELSE 0.1 + random() * 0.4 END)::int LOOP
        p := random();
        INSERT INTO invitados (id_invitacion, nombre, apellido, asiste, medio_pago, pago_verificado, fecha_respuesta)
        VALUES (inv, nombres[1 + floor(random() * 20)::int], apellidos[1 + floor(random() * 20)::int], p < 0.85,
                CASE WHEN p < 0.85 THEN (CASE WHEN random() < 0.55 THEN 'transferencia' ELSE 'efectivo' END) END,
                p < 0.85 AND random() < CASE WHEN f < hoy THEN 0.95 ELSE 0.6 END,
                LEAST(respondido + INTERVAL '3 days' + random() * GREATEST(LEAST(f, hoy) - respondido::date - 3, 0) * INTERVAL '1 day',
                      hoy + TIME '12:00'));
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Listo: % solicitudes de prueba en "Eventos del Centro"',
    (SELECT COUNT(*) FROM eventos e JOIN clientes c USING (id_cliente) WHERE c.id_empresa = emp AND c.institucion = ANY (inst));
END $$;
