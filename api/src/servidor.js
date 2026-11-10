import { almacenEnUso } from "./almacen.js";
import { app } from "./app.js";
import { sequelize } from "./modelos.js";
import { sembrar } from "./semilla.js";
import { DataTypes } from "sequelize";

const PUERTO = process.env.PORT ?? 3000;

// El ORM crea en la base las tablas que falten, a partir de los modelos.
await sequelize.sync();
// sync() no agrega columnas a una tabla que ya existe: la de demo se agrega aqui si falta.
const columnas = await sequelize.getQueryInterface().describeTable("viajes_camion");
if (!columnas.demo) await sequelize.getQueryInterface().addColumn("viajes_camion", "demo", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
// Lo mismo con las columnas de las cuentas en la tabla de usuarios.
const enUsuarios = await sequelize.getQueryInterface().describeTable("usuarios");
for (const [nombre, type] of [["clave_hash", DataTypes.STRING(200)], ["llave_cifrada", DataTypes.TEXT], ["prueba_llave", DataTypes.STRING(64)]]) {
  if (!enUsuarios[nombre]) await sequelize.getQueryInterface().addColumn("usuarios", nombre, { type });
}
const tablas = Object.values(sequelize.models).map((m) => m.tableName);
console.log(`Esquema sincronizado con la base de datos: ${tablas.length} tablas (${tablas.join(", ")})`);

console.log(`Base de datos: ${sequelize.getDialect()} · Fotos: ${almacenEnUso}`);

const sembrados = await sembrar();
if (sembrados) console.log(`Catalogo cargado: ${sembrados} lugares y sus rutas`);

const servidor = app.listen(PUERTO, () => console.log(`API de Grieta en http://localhost:${PUERTO}/api`));
// Conexiones que mandan los datos muy despacio se cortan: asi nadie deja al servidor esperando para tumbarlo.
servidor.headersTimeout = 15000;
servidor.requestTimeout = 60000;
