const RPC = require("discord-rpc");
const axios = require("axios");

const clientId = "1342157265725292676"; // ID de la aplicación en Discord
const instanceIconURL = "http://35.192.9.118/launcher/config-launcher/instanceIcon.json"; // JSON con los íconos personalizados

const rpc = new RPC.Client({ transport: "ipc" });

let currentInstance = "Fuji Team"; // Por defecto
let isConnected = false;
let isInGame = false; // Variable para saber si está en juego o en el menú
let imageMap = {}; // Para almacenar los íconos desde el JSON remoto
const defaultImageKey = "fuji_team"; // Nombre de la imagen subida en el Developer Portal

// Función para cargar los íconos desde el webhost
async function loadInstanceIcons() {
    try {
        const response = await axios.get(instanceIconURL);
        imageMap = response.data;
        console.log("✅ Iconos de instancia cargados correctamente.");
    } catch (error) {
        console.error("❌ Error al cargar los iconos de instancia:", error);
        imageMap = {}; // Si falla, solo usamos el predeterminado
    }
}

// Función para establecer la actividad en Discord
async function setActivity() {
    if (!isConnected) return;

    try {
        // Obtener la imagen desde el JSON, o usar el predeterminado de Fuji Team
        const imageKey = imageMap[currentInstance] || defaultImageKey;

        // Definir el estado y los detalles según si está en juego o en el menú
        let details, state;

        switch (true) {
            case isInGame:
                details = `Jugando en: ${currentInstance}`;
                state = "Jugando ahora";
                break;
            default:
                details = "En el menú";
                state = "Listo para jugar";
                break;
        }

        console.log(`🔹 Actualizando RPC: ${details} (isInGame = ${isInGame})`);

        await rpc.setActivity({
            details: details, // "Jugando: Instancia" o "En el menú"
            state: state, // "Jugando ahora" o "Listo para jugar"
            startTimestamp: Date.now(),
            largeImageKey: imageKey,
            largeImageText: `Modo: ${currentInstance}`,
            instance: true,
            buttons: [{ label: "Unirse al Servidor", url: "https://dsc.gg/fujiteam" }]
        });

        console.log(`🔹 Actividad actualizada: ${details} (Imagen: ${imageKey})`);
    } catch (error) {
        console.error("❌ Error al actualizar la actividad en Discord RPC:", error);
    }
}

// Evento cuando el RPC está listo
rpc.on("ready", async () => {
    isConnected = true;
    console.log("✅ Discord RPC conectado correctamente.");
    await loadInstanceIcons(); // Cargar íconos desde la web
    setActivity();
});

// Manejo de errores de conexión
rpc.on("error", (error) => {
    isConnected = false;
    console.error("❌ Error en la conexión de Discord RPC:", error);
});

// Iniciar la conexión con Discord RPC
rpc.login({ clientId }).catch((error) => {
    console.error("❌ Error al iniciar sesión en Discord RPC:", error);
});

// Manejar la salida del proceso
process.on("SIGINT", async () => {
    console.log("\n🛑 Cerrando Discord RPC...");
    if (isConnected) {
        await rpc.destroy().catch(console.error);
    }
    process.exit();
});

module.exports.updateInstance = async (newInstance, inGame) => {
    if (!isConnected) {
        console.log("⚠️ No se puede actualizar el estado de RPC porque aún no está conectado.");
        return;
    }

    console.log(`🔄 Intentando cambiar instancia...`);
    console.log(`➡️ Nuevo estado: ${newInstance} | En juego: ${inGame}`);

    currentInstance = newInstance;
    isInGame = inGame;

    console.log(`✅ Estado actualizado internamente.`);
    
    await loadInstanceIcons(); // Recargar íconos en caso de cambios en la web
    console.log(`📷 Iconos recargados.`);

    await setActivity(); // Se actualiza el estado en Discord
    console.log(`🎮 Rich Presence actualizado.`);
};