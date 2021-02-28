//const mongoose = require('mongoose');


(function () {

	$(document).ready(function () {
		(new OnvifManager()).init();
	});

	/*-------------------------------------------------------------------
	* Constructor
	* ---------------------------------------------------------------- */
	function OnvifManager() {
		this.ws = null; // WebSocket object
		this.el = { // jQuery objects for the HTML elements
			'frm_con': $('#connect-form'),
			'sel_dev': $('#connect-form select[name="device"]'),
			'inp_usr': $('#connect-form input[name="user"]'),
			'inp_pas': $('#connect-form input[name="pass"]'),
			'btn_con': $('#connect-form button[name="connect"]'),
			'div_pnl': $('#connected-device'),
			'img_snp': $('#connected-device img.snapshot'),
			'btn_dcn': $('#connected-device button[name="disconnect"]'),

			//KAZIK
			'btn_bgp': $('#connected-device button[name="get_position"]'),
			'btn_bsp': $('#connected-device button[name="set_position"]'),
			'sel_prs': $('#connected-device select[name="PTZ_position"]'),
			'inp_prs': $('#connected-device input[name="presetName"]'),

			//RADEK
			//SENDING MESSAGE TO SERVER
			'inp_TOM': $('#connected-device input[name="typeOfMessage"]'),
			//'sel_TOM': $('#connected-device select[name="typeOfMessage"]'),

			'inp_MSG': $('#connected-device input[name="inputMessage"]'),
			'btn_SMG': $('#connected-device button[name="buttonSendMessage"]'),
			//CONNECTING TO MONGO DB
			'inp_PDB': $('#connected-device input[name="inputPresetNameDatabase"]'),
			'btn_CDB': $('#connected-device button[name="buttonConnectToDatabase"]'),
			'btn_SNP': $('#connected-device button[name = "buttonSetNewPreset"]'),

			'sel_TOM': $('#connected-device select[name="selectPresetFromDatabase"]'),
			'btn_SPD': $('#connected-device button[name = "buttonSetPresetFromDatabase"]'),

			'mdl_msg': $('#message-modal'),
			'ptz_spd': $('input[name="ptz-speed"]'),
			'btn_hme': $('#connected-device div.ptz-pad-box button.ptz-goto-home'),
			'ptz_pad': $('#connected-device div.ptz-pad-box'),
			'zom_in': $('#connected-device div.ptz-zom-ctl-box button.ptz-zom-in'),
			'zom_out': $('#connected-device div.ptz-zom-ctl-box button.ptz-zom-ot'),
		};
		this.selected_address = '';
		this.device_connected = false;
		this.ptz_moving = false;
		this.snapshot_w = 400;
		this.snapshot_h = 300;
	}

	OnvifManager.prototype.init = function () {
		this.initWebSocketConnection();
		$(window).on('resize', this.adjustSize.bind(this));
		this.el['btn_con'].on('click', this.pressedConnectButton.bind(this));
		this.el['btn_dcn'].on('click', this.pressedConnectButton.bind(this));

		//KAZIK
		this.el['btn_bgp'].on('click', this.get_position_function.bind(this));
		this.el['btn_bsp'].on('click', this.set_position_function.bind(this));

		//RADEK
		this.el['btn_SMG'].on('click', this.pressedSendMessageButton.bind(this));
		this.el['btn_CDB'].on('click', this.pressedConnectToDatabaseButton.bind(this));
		//this.el['btn_SNP'].on('click', this.get_position_function.bind(this));
		//this.el['btn_SPD'].on('click', this.get_position_function.bind(this));

		$(document.body).on('keydown', this.ptzMove.bind(this));
		$(document.body).on('keyup', this.ptzStop.bind(this));
		this.el['btn_hme'].on('click', this.ptzGotoHome.bind(this));
		this.el['btn_hme'].on('touchstart', this.ptzGotoHome.bind(this));
		this.el['btn_hme'].on('touchend', this.ptzGotoHome.bind(this));
		this.el['ptz_pad'].on('mousedown', this.ptzMove.bind(this));
		this.el['ptz_pad'].on('mouseup', this.ptzStop.bind(this));
		this.el['ptz_pad'].on('touchstart', this.ptzMove.bind(this));
		this.el['ptz_pad'].on('touchend', this.ptzStop.bind(this));
		this.el['zom_in'].on('mousedown', this.ptzMove.bind(this));
		this.el['zom_in'].on('mouseup', this.ptzStop.bind(this));
		this.el['zom_in'].on('touchstart', this.ptzMove.bind(this));
		this.el['zom_in'].on('touchend', this.ptzStop.bind(this));
		this.el['zom_out'].on('mousedown', this.ptzMove.bind(this));
		this.el['zom_out'].on('mouseup', this.ptzStop.bind(this));
		this.el['zom_out'].on('touchstart', this.ptzMove.bind(this));
		this.el['zom_out'].on('touchend', this.ptzStop.bind(this));
	};

	OnvifManager.prototype.adjustSize = function () {
		var div_dom_el = this.el['div_pnl'].get(0);
		var rect = div_dom_el.getBoundingClientRect();
		var x = rect.left + window.pageXOffset;
		var y = rect.top + window.pageYOffset;
		var w = rect.width;
		var h = window.innerHeight - y - 10;
		div_dom_el.style.height = h + 'px';
		var aspect_ratio = w / h;
		var snapshot_aspect_ratio = this.snapshot_w / this.snapshot_h;
		var img_dom_el = this.el['img_snp'].get(0);

		if (snapshot_aspect_ratio > aspect_ratio) {
			img_w = w;
			img_h = (w / snapshot_aspect_ratio);
			img_dom_el.style.width = img_w + 'px';
			img_dom_el.style.height = img_h + 'px';
			img_dom_el.style.left = '0px';
			img_dom_el.style.top = ((h - img_h) / 2) + 'px';
		} else {
			img_h = h;
			img_w = (h * snapshot_aspect_ratio);
			img_dom_el.style.height = img_h + 'px';
			img_dom_el.style.width = img_w + 'px';
			img_dom_el.style.left = ((w - img_w) / 2) + 'px';
			img_dom_el.style.top = '0px';
		}
	};

	OnvifManager.prototype.initWebSocketConnection = function () {
		this.ws = new WebSocket('ws://' + document.location.host);
		this.ws.onopen = function () {
			console.log('WebSocket connection established.');
			this.sendRequest('startDiscovery');
			this.sendRequest('refreshPresets');
		}.bind(this);
		this.ws.onclose = function (event) {
			console.log('WebSocket connection closed.');
			this.showMessageModal('Error', 'The WebSocket connection was closed. Check if the server.js is running.');
		}.bind(this);
		this.ws.onerror = function (error) {
			this.showMessageModal('Error', 'Failed to establish a WebSocket connection. Check if the server.js is running.');
		}.bind(this);
		this.ws.onmessage = function (res) {
			var data = JSON.parse(res.data);
			var id = data.id;

			//Radek - wyświetlenie wiadomości od serwera; wszystkiego innego niż update obrazka
			if (id !== 'fetchSnapshot') {
				console.log('	Wiadomość od serwera: ' + JSON.stringify(data));
			}

			if (id === 'startDiscovery') {
				this.startDiscoveryCallback(data);
			} else if (id === 'connect') {
				this.connectCallback(data);
			} else if (id === 'fetchSnapshot') {
				this.fetchSnapshotCallback(data);
			} else if (id === 'ptzMove') {
				this.ptzMoveCallback(data);
			} else if (id === 'ptzStop') {
				this.ptzStopCallback(data);
			} else if (id === 'ptzHome') {
				this.ptzHomeCallback(data);
			} else if (id === 'refreshPresets') {
				this.refreshPresetsCallback(data);
			}
			//Radek - handlery od nowych funkcji	
			//else if (id === 'database') {}


		}.bind(this);
	};

	OnvifManager.prototype.sendRequest = function (method, params) {
		this.ws.send(JSON.stringify({
			'method': method,
			'params': params
		}));
	};

	OnvifManager.prototype.pressedConnectButton = function (event) {
		if (this.device_connected === true) {
			this.disconnectDevice();
		} else {
			this.connectDevice();
		}
	};

	OnvifManager.prototype.disconnectDevice = function () {
		this.el['img_snp'].removeAttr('src');
		this.el['div_pnl'].hide();
		this.el['frm_con'].show();
		this.device_connected = false;
		this.disabledLoginForm(false);
		this.el['btn_con'].text('Connect');
	};

	/* Kazik:	funkcja zapisująca nową pozycję w bazie danych */

	OnvifManager.prototype.get_position_function = function () {
		console.log('odpalona funkcja get_position');
		this.sendRequest('get_position', {
			'address': this.selected_address,
			'timeout': 30,
			'presetName': this.el['inp_prs'].val()
		});
	};

	/* Kazik:	funkcja przywracająca pozycję kamery wg wybranego w ComboBoksie presetu */

	OnvifManager.prototype.set_position_function = function () {
		console.log('odpalona funkcja set_position');
		this.sendRequest('set_position', {
			'address': this.selected_address,
			'timeout': 30,
			'preset': this.el['sel_prs'].val()
		});
	};

	/* Kazik:	funkcja odświeżająca zawartość ComboBoksa w przeglądarce */

	OnvifManager.prototype.refreshPresetsCallback = function (data) {
		var presets = data.result;
		this.el['sel_prs'].empty();
		var n = 0;
		for (var key in presets) {
			var preset = presets[key];
			var option_el = $('<option></option>');
			option_el.val(preset.presetValue); /* nazwa pliku */
			option_el.text(preset.presetName);       /* W zasadzie też nazwa pliku */
			this.el['sel_prs'].append(option_el);
			n++;
		}
		this.el['sel_prs'].prop('disabled', false);
		this.el['inp_prs'].prop('disabled', false);

		if (n === 0) {
			this.el['sel_prs'].append($('<option>There are no presets</option>'));
		}
	};



	OnvifManager.prototype.connectDevice = function () {
		this.disabledLoginForm(true);
		this.el['btn_con'].text('Connecting...');
		this.sendRequest('connect', {
			'address': this.el['sel_dev'].val(),
			'user': this.el['inp_usr'].val(),
			'pass': this.el['inp_pas'].val()
		});
	}

	OnvifManager.prototype.disabledLoginForm = function (disabled) {
		this.el['sel_dev'].prop('disabled', disabled);
		this.el['inp_usr'].prop('disabled', disabled);
		this.el['inp_pas'].prop('disabled', disabled);
		this.el['btn_con'].prop('disabled', disabled);
	};

	OnvifManager.prototype.startDiscoveryCallback = function (data) {
		var devices = data.result;
		this.el['sel_dev'].empty();
		this.el['sel_dev'].append($('<option>Select a device</option>'));
		var n = 0;
		for (var key in devices) {
			var device = devices[key];
			var option_el = $('<option></option>');
			option_el.val(device.address);
			option_el.text(device.name + ' (' + device.address + ')');
			this.el['sel_dev'].append(option_el);
			n++;
		}
		if (n === 0) {
			this.showMessageModal('Error', 'No device was found. Reload this page to discover ONVIF devices again.')
		} else {
			this.disabledLoginForm(false);
		}
	};

	OnvifManager.prototype.connectCallback = function (data) {
		this.el['btn_con'].prop('disabled', false);
		if (data.result) {
			this.selected_address = this.el['sel_dev'].val();
			this.showConnectedDeviceInfo(this.selected_address, data.result);
			this.el['btn_con'].text('Disconnect');
			this.el['frm_con'].hide();
			this.el['div_pnl'].show();
			this.device_connected = true;
		} else if (data.error) {
			this.el['div_pnl'].hide();
			this.el['sel_dev'].prop('disabled', false);
			this.el['inp_usr'].prop('disabled', false);
			this.el['inp_pas'].prop('disabled', false);
			this.el['btn_con'].text('Connect');
			this.el['frm_con'].show();
			this.showMessageModal('Error', 'Failed to connect to the device.' + data.error.toString());
			this.device_connected = false;
		}
	};

	OnvifManager.prototype.showMessageModal = function (title, message) {
		this.el['mdl_msg'].find('.modal-title').text(title);
		this.el['mdl_msg'].find('.modal-message').text(message);
		this.el['mdl_msg'].modal('show');
	};

	OnvifManager.prototype.showConnectedDeviceInfo = function (address, data) {
		this.el['div_pnl'].find('span.name').text(data['Manufacturer'] + ' ' + data['Model']);
		this.el['div_pnl'].find('span.address').text(address);
		this.fetchSnapshot();
	};

	OnvifManager.prototype.fetchSnapshot = function () {
		this.sendRequest('fetchSnapshot', {
			'address': this.selected_address
		});
	};

	OnvifManager.prototype.fetchSnapshotCallback = function (data) {
		if (data.result) {
			this.el['img_snp'].attr('src', data.result);
			window.setTimeout(function () {
				this.snapshot_w = this.el['img_snp'].get(0).naturalWidth;
				this.snapshot_h = this.el['img_snp'].get(0).naturalHeight;
				this.adjustSize();
				if (this.device_connected === true) {
					this.fetchSnapshot();
				}
			}.bind(this), 10);
		} else if (data.error) {
			console.log(data.error);
		}
	};

	OnvifManager.prototype.ptzGotoHome = function (event) {
		event.preventDefault();
		event.stopPropagation();
		if (event.type === 'touchstart') {
			return;
		}
		if (this.device_connected === false || this.ptz_moving === true) {
			return;
		}
		this.ptz_moving = true;
		this.sendRequest('ptzHome', {
			'address': this.selected_address,
			'timeout': 30
		});
	};

	OnvifManager.prototype.ptzMove = function (event) {
		if (this.device_connected === false || this.ptz_moving === true) {
			return;
		}
		this.ptz_moving = true;
		var pos = { x: 0, y: 0, z: 0 };
		var speed = 1.0;

		if (event.type === 'keydown') {
			this.el['ptz_spd'].each(function (index, el) {
				if ($(el).prop('checked') === true) {
					speed = parseFloat($(el).val());
				}
			}.bind(this));
			var c = event.keyCode;
			var s = event.shiftKey;
			if (c === 38) { // Up
				pos.y = speed;
			} else if (c === 40) { // Down
				pos.y = 0 - speed;
			} else if (c === 37) { // Left
				pos.x = 0 - speed;
			} else if (c === 39) { // Right
				pos.x = speed;
			} else if ((c === 107) || c === 187) { // Zoom in
				pos.z = speed;
			} else if (c === 109 || c === 189) { // Zoom out
				pos.z = 0 - speed;
			} else {
				return;
			}
		} else if (event.type.match(/^(mousedown|touchstart)$/)) {
			if (event.currentTarget.classList.contains('ptz-pad-box')) {
				var rect = event.currentTarget.getBoundingClientRect();
				var cx = event.clientX;
				var cy = event.clientY;
				if (event.type === 'touchstart') {
					if (event.targetTouches[0]) {
						cx = event.targetTouches[0].clientX;
						cy = event.targetTouches[0].clientY;
					} else if (event.changedTouches[0]) {
						cx = event.changedTouches[0].clientX;
						cy = event.changedTouches[0].clientY;
					}
				}
				var mx = cx - rect.left;
				var my = cy - rect.top;
				var w = rect.width;
				var h = rect.height;
				var r = Math.max(w, h) / 2;
				var x = mx - r;
				var y = r - my;
				var d = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) / r;
				var rad = Math.atan2(y, x);
				pos.x = d * Math.cos(rad);
				pos.y = d * Math.sin(rad);
			} else if (event.currentTarget.classList.contains('ptz-zom')) {
				if (event.currentTarget.classList.contains('ptz-zom-ot')) {
					pos.z = -1.0;
				} else if (event.currentTarget.classList.contains('ptz-zom-in')) {
					pos.z = 1.0;
				} else {
					return;
				}
			} else {
				return;
			}
		} else {
			return;
		}

		this.sendRequest('ptzMove', {
			'address': this.selected_address,
			'speed': pos,
			'timeout': 30
		});
		event.preventDefault();
		event.stopPropagation();
	};

	OnvifManager.prototype.ptzStop = function (event) {
		if (!this.selected_address) {
			return;
		}
		this.sendRequest('ptzStop', {
			'address': this.selected_address
		});
		this.ptz_moving = false;
	};

	//RADEK
	OnvifManager.prototype.pressedSendMessageButton = function () {
		const typeOfMessage = this.el['inp_TOM'].val();
		//const typeOfMessage = this.el['sel_TOM'].val();
		const messageContent = this.el['inp_MSG'].val();
		console.log('typeOfMessage: ' + typeOfMessage);
		console.log('messageContent: ' + messageContent);

		this.sendRequest(typeOfMessage, {
			'message': messageContent
		})
	};

	OnvifManager.prototype.pressedConnectToDatabaseButton = function () {
		this.el['div_pnl'].find('span.connectionToDatabaseStatus').text('trying to connect...');
		this.sendRequest('databaseHandler', {
			'address': this.selected_address,
		});

	};


	OnvifManager.prototype.ptzMoveCallback = function (data) {
		// do nothing
	};

	OnvifManager.prototype.ptzStopCallback = function (data) {
		// do nothing
	};

	OnvifManager.prototype.ptzHomeCallback = function (data) {
		// do nothing
	};

})();
