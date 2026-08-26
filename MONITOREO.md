# Vigilancia de ventas DIFIORI

Dos vigilantes que responden a dos preguntas distintas:

| Vigilante | Pregunta | Dónde corre | Cada cuánto |
|---|---|---|---|
| `storefront-watchdog` | ¿Se puede comprar ahora mismo? | Fuera del servidor (GitHub Actions) | 15 min |
| `sales-watchdog` | ¿Se está vendiendo con normalidad? | En el servidor, junto al backend | 15 min |

El primero corre **fuera** a propósito: si el servidor se cae del todo, un cron que viva dentro de él no podría avisar de nada. El segundo necesita la base de datos, así que vive dentro.

---

## 1. Vigilante de la tienda

Comprueba, como lo haría un cliente, que la tienda se pueda comprar:

- La tienda carga y trae contenido.
- **Los enlaces de publicidad llevan a la tienda** y no a "Página no encontrada" (`fbclid`, `utm_*`, `gclid`).
- El catálogo tiene productos, todos con precio e imagen.
- La tienda acepta pedidos y tiene sectores de envío configurados.
- El checkout está disponible.
- El registro de pedidos responde (si el backend cae, ningún pedido entraría).
- **Payphone y PayPal cobran de verdad**, no en modo de pruebas.
- Analytics está configurado.
- La tienda responde por debajo de 4 segundos.

```bash
npm run watchdog:tienda
```

Sale con código `1` si algo crítico falla. Ya está programado en `.github/workflows/watchdog-tienda.yml` cada 15 minutos; cuando falla, GitHub avisa por correo al dueño del repositorio.

Para vigilar otro dominio: `WATCHDOG_BASE_URL=https://otro-dominio npm run watchdog:tienda`.

### Por qué comprueba el modo de la pasarela

Una pasarela en `sandbox` responde a todo con normalidad pero **no cobra dinero real**: el cliente cree que pagó y la venta nunca entra. Desde fuera, la tienda parece perfecta. Por eso se comprueba el entorno, no solo que la pasarela conteste.

---

## 2. Vigilante de ventas

Corre en el servidor, consulta la base de datos y avisa por correo cuando el ritmo de ventas se sale de lo normal.

```bash
cd admin-floreria/api
npm run watchdog:ventas             # revisión normal
node scripts/sales-watchdog.js --json      # solo métricas, sin avisos
node scripts/sales-watchdog.js --dry-run   # evalúa y muestra, sin enviar correo
npm run watchdog:ventas:resumen     # resumen del día por correo
npm run watchdog:test               # prueba las reglas (sin base de datos)
```

### Qué vigila

| Aviso | Cuándo salta | Nivel |
|---|---|---|
| `tienda-cerrada` | "Aceptar pedidos" está desactivado en el panel | CRÍTICO |
| `catalogo-vacio` | No hay productos activos | CRÍTICO |
| `sin-ventas` | Ni una venta en 5 horas, en horario comercial | CRÍTICO |
| `pagos-fallando` | Más del 30 % de los cobros del día fallaron (mínimo 3 intentos) | CRÍTICO |
| `caida-ventas` | El día va por debajo del 40 % de lo habitual a esta hora | ALTO |
| `pendientes-estancados` | 3 o más pedidos llevan más de 2 h sin completar el pago | ALTO |
| `sin-comprobante` | 3 o más transferencias sin comprobante adjunto | MEDIO |
| `abandono-alto` | Se abandonan más del triple de carritos que pedidos cerrados | MEDIO |

Compara siempre contra **el mismo día de la semana de las últimas 4 semanas a la misma hora**. Sin esa referencia, "cero ventas" un martes a mediodía y "cero ventas" un domingo a las 7 de la mañana parecerían el mismo problema.

Fuera del horario comercial (por defecto 08:00–20:00) no avisa por falta de ventas.

### Para que no se vuelva ruido

Cada tipo de aviso se envía **como máximo una vez cada 3 horas**. El estado se guarda en `admin-floreria/api/logs/sales-watchdog-state.json`. Un vigilante que avisa de todo se acaba ignorando.

### Ajustes

Todo por variables de entorno, con valores por defecto razonables:

```bash
WATCHDOG_ALERT_EMAIL=ventas@difiori.com.ec   # a quién avisar
WATCHDOG_HORAS_SIN_VENTA=5                   # horas sin venta que disparan aviso
WATCHDOG_HORA_INICIO=8                       # apertura
WATCHDOG_HORA_FIN=20                         # cierre
WATCHDOG_CAIDA_PCT=40                        # % de lo normal por debajo del cual se avisa
WATCHDOG_COOLDOWN_HORAS=3                    # espera antes de repetir el mismo aviso
```

---

## 3. Instalación en el servidor

El vigilante de ventas necesita las mismas variables que el backend (`DATABASE_URL` y el SMTP). La forma más simple es cron:

```bash
crontab -e
```

```cron
# Vigilante de ventas, cada 15 minutos
*/15 * * * * cd /ruta/al/proyecto/admin-floreria/api && /usr/bin/node scripts/sales-watchdog.js >> logs/watchdog.log 2>&1

# Resumen del día a las 21:00
0 21 * * * cd /ruta/al/proyecto/admin-floreria/api && /usr/bin/node scripts/sales-watchdog.js --resumen >> logs/watchdog.log 2>&1
```

Si el backend corre con PM2 y prefieres mantenerlo todo ahí:

```bash
pm2 start scripts/sales-watchdog.js --name difiori-watchdog --cron "*/15 * * * *" --no-autorestart
pm2 save
```

Comprueba que arrancó bien antes de dejarlo solo:

```bash
cd admin-floreria/api && node scripts/sales-watchdog.js --dry-run
```

Debe imprimir las métricas del día y, si hay algo raro, los avisos que habría enviado.

---

## 4. Revisión rápida a mano

Cuando sospeches que algo va mal y quieras una respuesta en 30 segundos:

```bash
npm run watchdog:tienda                                    # ¿se puede comprar?
cd admin-floreria/api && node scripts/sales-watchdog.js --json   # ¿cuánto se vendió hoy?
```
