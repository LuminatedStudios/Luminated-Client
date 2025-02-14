/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { ipcRenderer } = require('electron');
const { Status } = require('minecraft-java-core');
const fs = require('fs');
const pkg = require('../package.json');

import config from './utils/config.js';
import database from './utils/database.js';
import logger from './utils/logger.js';
import popup from './utils/popup.js';
import { skin2D } from './utils/skin.js';
import slider from './utils/slider.js';

async function setBackground(theme) {
    if (typeof theme == 'undefined') {
        let databaseLauncher = new database();
        let configClient = await databaseLauncher.readData('configClient');
        theme = configClient?.launcher_config?.theme || "auto";
        theme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res);
    }
    let background;
    let body = document.body;
    body.className = theme ? 'dark global' : 'light global';
    if (fs.existsSync(`${__dirname}/assets/images/background/easterEgg`) && Math.random() < 0.005) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/easterEgg`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `url(./assets/images/background/easterEgg/${Background})`;
    } else if (fs.existsSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`)) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `linear-gradient(#00000080, #00000080), url(./assets/images/background/${theme ? 'dark' : 'light'}/${Background})`;
    }
    body.style.backgroundImage = background ? background : theme ? '#000' : '#fff';
    body.style.backgroundSize = 'cover';
}

async function setInstanceBackground(backgroundUrl) {
    let body = document.body;

    // Verificar si la URL es válida
    if (backgroundUrl && backgroundUrl.match(/^(http|https):\/\/[^ "]+$/)) {
        body.style.backgroundImage = `linear-gradient(#00000080, #00000080), url(${backgroundUrl})`;
    } else {
        // Usar el fondo predeterminado fuji.mp4 si no se proporciona una URL válida
        let video = document.createElement('video');
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.src = './assets/images/background/dark/fuji.mp4';
        video.style.position = 'fixed';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.zIndex = '-1';
        document.body.appendChild(video);
    }

    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
}

async function changePanel(id) {
    let panel = document.querySelector(`.${id}`);
    let active = document.querySelector(`.active`);
    if (active) active.classList.toggle("active");
    panel.classList.add("active");
}

async function appdata() {
    return await ipcRenderer.invoke('appData').then(path => path);
}

async function addAccount(data) {
    let skin = false;
    if (data?.profile?.skins[0]?.base64) skin = await new skin2D().creatHeadTexture(data.profile.skins[0].base64);
    let div = document.createElement("div");
    div.classList.add("account");
    div.id = data.ID;
    div.innerHTML = `
        <div class="profile-image" ${skin ? 'style="background-image: url(' + skin + ');"' : ''}></div>
        <div class="profile-infos">
            <div class="profile-pseudo">${data.name}</div>
            <div class="profile-uuid">${data.uuid}</div>
        </div>
        <div class="delete-profile" id="${data.ID}">
            <div class="icon-account-delete delete-profile-icon"></div>
        </div>
    `;
    return document.querySelector('.accounts-list').appendChild(div);
}

async function accountSelect(data) {
    // Verificar si los datos son válidos
    if (!data || !data.ID) {
        console.error('Datos inválidos o falta el ID:', data);
        return;
    }

    // Obtener el elemento de la cuenta por su ID
    let account = document.getElementById(`${data.ID}`);

    // Verificar si el elemento existe
    if (!account) {
        console.error(`No se encontró el elemento de la cuenta con ID "${data.ID}".`);
        return;
    }

    // Deseleccionar la cuenta activa (si existe)
    let activeAccount = document.querySelector('.account-select');
    if (activeAccount) {
        activeAccount.classList.remove('account-select');
    }

    // Seleccionar la nueva cuenta
    account.classList.add('account-select');

    // Actualizar la cabeza del jugador si hay una skin disponible
    if (data?.profile?.skins[0]?.base64) {
        await headplayer(data.profile.skins[0].base64);
    }
}
async function headplayer(skinBase64) {
    let skin = await new skin2D().creatHeadTexture(skinBase64);
    document.querySelector(".player-head").style.backgroundImage = `url(${skin})`;
}

async function setStatus(opt) {
    let nameServerElement = document.querySelector('.server-status-name');
    let statusServerElement = document.querySelector('.server-status-text');
    let playersOnline = document.querySelector('.status-player-count .player-count');

    if (!opt) {
        statusServerElement.classList.add('red');
        statusServerElement.innerHTML = `Ferme - 0 ms`;
        document.querySelector('.status-player-count').classList.add('red');
        playersOnline.innerHTML = '0';
        return;
    }

    let { ip, port, nameServer } = opt;
    nameServerElement.innerHTML = nameServer;
    let status = new Status(ip, port);
    let statusServer = await status.getStatus().then(res => res).catch(err => err);

    if (!statusServer.error) {
        statusServerElement.classList.remove('red');
        document.querySelector('.status-player-count').classList.remove('red');
        statusServerElement.innerHTML = `En ligne - ${statusServer.ms} ms`;
        playersOnline.innerHTML = statusServer.playersConnect;
    } else {
        statusServerElement.classList.add('red');
        statusServerElement.innerHTML = `Ferme - 0 ms`;
        document.querySelector('.status-player-count').classList.add('red');
        playersOnline.innerHTML = '0';
    }
}

export {
    appdata as appdata,
    changePanel as changePanel,
    config as config,
    database as database,
    logger as logger,
    popup as popup,
    setBackground as setBackground,
    setInstanceBackground as setInstanceBackground,
    skin2D as skin2D,
    addAccount as addAccount,
    accountSelect as accountSelect, // Función arreglada
    slider as Slider,
    pkg as pkg,
    setStatus as setStatus
};