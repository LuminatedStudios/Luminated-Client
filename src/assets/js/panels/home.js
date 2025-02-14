/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import { config, database, logger, changePanel, appdata, setInstanceBackground, pkg, popup } from '../utils.js';
const { updateInstance } = require("./assets/js/utils/discordRPC.js");
 // Importar la función de discordRPC.js

const { Launch } = require('minecraft-java-core');
const { shell, ipcRenderer } = require('electron');

class Home {
    static id = "home";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.socialLick();
        this.instancesSelect(); // Inicializar la selección de instancias
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'));
        await this.loadRecentInstances(); // Cargar instancias recientes
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block');
        socials.forEach(social => {
            social.addEventListener('click', e => {
                shell.openExternal(e.target.dataset.url);
            });
        });
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient');
        let auth = await this.db.readData('accounts', configClient.account_selected); // Obtener la cuenta autenticada
        let username = auth?.username; // Obtener el nombre de usuario de la cuenta autenticada
        let instancesList = await config.getInstanceList();
        let instanceSelect = instancesList.find(i => i.name == configClient?.instance_selct) ? configClient?.instance_selct : null;

        let instanceBTN = document.querySelector('.play-instance');
        let instancePopup = document.querySelector('.instance-popup');
        let instancesGrid = document.querySelector('.instances-grid');
        let instanceSelectBTN = document.querySelector('.instance-select');
        let instanceCloseBTN = document.querySelector('.close-popup');

        if (instancesList.length === 1) {
            instanceSelectBTN.style.display = 'none';
        }

        if (!instanceSelect) {
            let newInstanceSelect = instancesList.find(i => i.whitelistActive == false);
            configClient.instance_selct = newInstanceSelect.name;
            instanceSelect = newInstanceSelect.name;
            await this.db.updateData('configClient', configClient);
        }

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == username);
                if (whitelist !== username) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false);
                        configClient.instance_selct = newInstanceSelect.name;
                        instanceSelect = newInstanceSelect.name;
                        setInstanceBackground(newInstanceSelect.background);
                        await this.db.updateData('configClient', configClient);
                    }
                }
            } else {
                console.log(`Configurando instancia ${instance.name}...`);
            }
            if (instance.name == instanceSelect) setInstanceBackground(instance.background);
            if (instance.name == instanceSelect) this.updateSelectedInstanceStyle(instanceSelect);
        }

        instanceSelectBTN.addEventListener('click', async () => {
            instancesGrid.innerHTML = '';
            for (let instance of instancesList) {
                let color = instance.maintenance ? 'red' : 'green';
                let whitelist = instance.whitelistActive && instance.whitelist.includes(username);
                let imageUrl = instance.thumbnail || 'assets/images/default/placeholder.jpg';
                if (!instance.whitelistActive || whitelist) {
                    instancesGrid.innerHTML += `
                        <div id="${instance.name}" class="instance-element ${instance.name === instanceSelect ? 'active-instance' : ''}">
                            <div class="instance-image" style="background-image: url('${imageUrl}');"></div>
                            <div class="instance-name">${instance.name}<div class="instance-mkid" style="background-color: ${color};"></div></div>
                        </div>`;
                }
            }
            instancePopup.classList.add('show');
        });

        instancePopup.addEventListener('click', async e => {
            if (e.target.closest('.instance-element')) {
                let newInstanceSelect = e.target.closest('.instance-element').id;
                let activeInstanceSelect = document.querySelector('.active-instance');

                if (activeInstanceSelect) activeInstanceSelect.classList.remove('active-instance');
                e.target.closest('.instance-element').classList.add('active-instance');

                configClient.instance_selct = newInstanceSelect;
                await this.db.updateData('configClient', configClient);
                instanceSelect = newInstanceSelect;
                instancePopup.classList.remove('show');
                let instance = await config.getInstanceList();
                let options = instance.find(i => i.name == configClient.instance_selct);
                setInstanceBackground(options.background);
                this.updateSelectedInstanceStyle(newInstanceSelect);

                // Actualizar Discord RPC con la nueva instancia
                updateInstance(newInstanceSelect);
            }
        });

        instanceBTN.addEventListener('click', async () => {
            this.startGame();
        });

        instanceCloseBTN.addEventListener('click', () => {
            instancePopup.classList.remove('show');
        });
    }

    async loadRecentInstances() {
        let configClient = await this.db.readData('configClient');
        let recentInstances = configClient.recent_instances || [];
        let recentInstancesContainer = document.querySelector('.recent-instances');

        recentInstancesContainer.innerHTML = '';

        for (let instanceName of recentInstances) {
            let instance = await config.getInstanceList().then(instances => instances.find(i => i.name === instanceName));
            if (instance) {
                let button = document.createElement('div');
                button.classList.add('recent-instance-button');
                button.style.backgroundImage = `url(${instance.icon || instance.thumbnail || 'assets/images/default/placeholder.jpg'})`;
                button.dataset.instanceName = instanceName;
                if (instanceName === configClient.instance_selct) {
                    button.classList.add('selected-instance');
                }
                button.addEventListener('click', async () => {
                    await this.selectInstance(instanceName);
                });
                recentInstancesContainer.appendChild(button);
            } else {
                recentInstances = recentInstances.filter(name => name !== instanceName);
                configClient.recent_instances = recentInstances;
                await this.db.updateData('configClient', configClient);
            }
        }
    }

    async selectInstance(instanceName) {
        let configClient = await this.db.readData('configClient');
        configClient.instance_selct = instanceName;
        await this.db.updateData('configClient', configClient);
        let instance = await config.getInstanceList().then(instances => instances.find(i => i.name === instanceName));
        setInstanceBackground(instance.background);
        this.updateSelectedInstanceStyle(instanceName);

        // Actualizar Discord RPC con la nueva instancia
        updateInstance(instanceName);
    }

    updateSelectedInstanceStyle(instanceName) {
        let recentInstancesContainer = document.querySelector('.recent-instances');
        let buttons = recentInstancesContainer.querySelectorAll('.recent-instance-button');
        buttons.forEach(button => {
            if (button.dataset.instanceName === instanceName) {
                button.classList.add('selected-instance');
            } else {
                button.classList.remove('selected-instance');
            }
        });
    }

    async startGame() {
        let launch = new Launch();
        let configClient = await this.db.readData('configClient');
        let instance = await config.getInstanceList();
        let authenticator = await this.db.readData('accounts', configClient.account_selected);
        let options = instance.find(i => i.name == configClient.instance_selct);

        let username = authenticator?.username; // Obtener el nombre de usuario de la cuenta autenticada
        if (options.whitelistActive && !options.whitelist.includes(username)) {
            let popupError = new popup();
            popupError.openPopup({
                title: 'Error',
                content: 'No tienes permiso para iniciar esta instancia.',
                color: 'red',
                options: true
            });
            return;
        }

        if (options.maintenance) {
            let popupError = new popup();
            popupError.openPopup({
                title: 'Error al iniciar el cliente',
                content: options.maintenancemsg || 'El cliente no se encuentra disponible.',
                color: 'red',
                options: true
            });
            return;
        }

        let opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loadder.minecraft_version,
            detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true, // Usar closeLauncher
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,

            loader: {
                type: options.loadder.loadder_type,
                build: options.loadder.loadder_version,
                enable: options.loadder_type == 'none' ? false : true
            },

            verify: options.verify,

            ignored: [...options.ignored],

            javaPath: configClient.java_config.java_path,

            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },

            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        };

        launch.Launch(opt);

        let playInstanceBTN = document.querySelector('.play-instance');
        let infoStartingBOX = document.querySelector('.info-starting-game');
        let infoStarting = document.querySelector(".info-starting-game-text");
        let progressBar = document.querySelector('.progress-bar');

        playInstanceBTN.style.display = "none";
        infoStartingBOX.style.display = "block";
        progressBar.style.display = "";
        ipcRenderer.send('main-window-progress-load');

        launch.on('progress', (progress, size) => {
            infoStarting.innerHTML = `Descargando ${((progress / size) * 100).toFixed(0)}%`;
            ipcRenderer.send('main-window-progress', { progress, size });
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('close', code => {
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show"); // Mostrar la ventana del launcher si se cierra el juego
            };
            ipcRenderer.send('main-window-progress-reset');
            infoStartingBOX.style.display = "none";
            playInstanceBTN.style.display = "flex";
            infoStarting.innerHTML = `Verificando`;
            new logger(pkg.name, '#7289da');
            console.log('Close');
        });

        launch.on('error', err => {
            let popupError = new popup();
            popupError.openPopup({
                title: 'Error',
                content: err.error,
                color: 'red',
                options: true
            });

            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show"); // Mostrar la ventana del launcher si hay un error
            };
            ipcRenderer.send('main-window-progress-reset');
            infoStartingBOX.style.display = "none";
            playInstanceBTN.style.display = "flex";
            infoStarting.innerHTML = `Verificando`;
            new logger(pkg.name, '#7289da');
            console.log(err);
        });
    }

    getdate(e) {
        let date = new Date(e);
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let allMonth = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return { year: year, month: allMonth[month - 1], day: day };
    }
}
export default Home;