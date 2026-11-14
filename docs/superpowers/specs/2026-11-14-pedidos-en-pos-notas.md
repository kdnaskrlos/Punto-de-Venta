# Pedidos dentro del POS — notas para una fase futura

Acordado con Carlos el 14-nov-2026. Se hará después de cerrar la fase 1.

## Decisión
La app Pedidos (encargos de fabricación/personalización) se unifica dentro del POS. La app Pedidos deja de tener usuarios propios: Carlos (administrador), su esposa (encargada) y la vendedora usan todo desde el POS con sus roles.

## Permisos
| Acción | Administrador | Encargada | Vendedora |
|---|---|---|---|
| Ver todos los pedidos | sí | sí | sí |
| Crear pedido y cobrar abono | sí | sí | sí |
| Marcar «Listo» y avisar por WhatsApp | sí | sí | sí |
| Entregar y cobrar el saldo | sí | sí | sí |
| Editar | siempre | siempre | solo antes de «Listo» |
| Borrar / reabrir | sí | sí | no |
| Ajustes de Pedidos | sí | no | no |

- Se eliminan los permisos por persona que tenía la app Pedidos.
- Abono y saldo pasan por el cobro y la caja del POS, igual que los apartados (cuentan en caja, comisiones y reportes).
- Migración única de los datos desde el proyecto Firebase de Pedidos.
