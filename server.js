'use strict';
process.chdir(__dirname);

const mongoose = require('mongoose');
//const Position = require('./schema/position.js');
var onvif = null;
try {
	onvif = require('../../lib/node-onvif.js');

} catch (e) {
	onvif = require('node-onvif');
}
var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');
var port = 8880;

(function main() {
	var http_server = http.createServer(httpServerRequest);
	http_server.listen(port, function () {
		console.log("Listening on port " + port);
	});
	var wsserver = new WebSocketServer({
		httpServer: http_server,
	});
	wsserver.on('request', wsServerRequest);
})();

function httpServerRequest(req, res) {
	var path = req.url.replace(/\?.*$/, '');
	if (path.match(/\.{2,}/) || path.match(/[^a-zA-Z\d\_\-\.\/]/)) {
		httpServerResponse404(req.url, res);
		return;
	}
	if (path === '/') {
		path = '/index.html';
	}
	var fpath = './html' + path;
	fs.readFile(fpath, 'utf-8', function (err, data) {
		if (err) {
			httpServerResponse404(req.url, res);
			return;
		} else {
			var ctype = getContentType(fpath);
			res.writeHead(200, { 'Content-Type': ctype });
			res.write(data);
			res.end();
			console.log('HTTP : 200 OK : ' + req.url);
		}
	});
}

function getContentType(fpath) {
	var ext = fpath.split('.').pop().toLowerCase();
	if (ext.match(/^(html|htm)$/)) {
		return 'text/html';
	} else if (ext.match(/^(jpeg|jpg)$/)) {
		return 'image/jpeg';
	} else if (ext.match(/^(png|gif)$/)) {
		return 'image/' + ext;
	} else if (ext === 'css') {
		return 'text/css';
	} else if (ext === 'js') {
		return 'text/javascript';
	} else if (ext === 'woff2') {
		return 'application/font-woff';
	} else if (ext === 'woff') {
		return 'application/font-woff';
	} else if (ext === 'ttf') {
		return 'application/font-ttf';
	} else if (ext === 'svg') {
		return 'image/svg+xml';
	} else if (ext === 'eot') {
		return 'application/vnd.ms-fontobject';
	} else if (ext === 'oft') {
		return 'application/x-font-otf';
	} else {
		return 'application/octet-stream';
	}
}

function httpServerResponse404(url, res) {
	res.writeHead(404, { 'Content-Type': 'text/plain' });
	res.write('404 Not Found: ' + url);
	res.end();
	console.log('HTTP : 404 Not Found : ' + url);
}

var client_list = [];

function wsServerRequest(request) {
	var conn = request.accept(null, request.origin);
	conn.on("message", function (message) {
		if (message.type !== 'utf8') {
			return;
		}
		var data = JSON.parse(message.utf8Data);
		var method = data['method'];
		var params = data['params'];

		if (method !== 'fetchSnapshot') {
			console.log('Client message: ' + message.utf8Data);
		}

		if (method === 'startDiscovery') {
			startDiscovery(conn);
		} else if (method === 'connect') {
			connect(conn, params);
		} else if (method === 'fetchSnapshot') {
			fetchSnapshot(conn, params);
		} else if (method === 'ptzMove') {
			ptzMove(conn, params);
		} else if (method === 'ptzStop') {
			ptzStop(conn, params);
		} else if (method === 'ptzHome') {
			ptzHome(conn, params);
		}
		//KAZIK
		else if (method === 'get_position') {
			get_position(conn, params);
		} else if (method === 'set_position') {
			set_position(conn, params);
		} else if (method === 'refreshPresets') {
			refreshPresets(conn, params);
		}
		//RADEK
		else if (method === 'chat') {
			chatReceiver(conn, data);
		} else if (method === 'databaseHandler') {
			//obsługa poleceń z klienta dla bazy danych
			connectToDatabase(conn, params);
		}

	});

	conn.on("close", function (message) {

	});
	conn.on("error", function (error) {
		console.log(error);
	});
};

var devices = {};
function startDiscovery(conn) {
	devices = {};
	let names = {};
	onvif.startProbe().then((device_list) => {
		device_list.forEach((device) => {
			let odevice = new onvif.OnvifDevice({
				xaddr: device.xaddrs[0]
			});
			let addr = odevice.address;
			devices[addr] = odevice;
			names[addr] = device.name;
		});
		var devs = {};
		for (var addr in devices) {
			devs[addr] = {
				name: names[addr],
				address: addr
			}
		}
		let res = { 'id': 'startDiscovery', 'result': devs };
		conn.send(JSON.stringify(res));
	}).catch((error) => {
		let res = { 'id': 'connect', 'error': error.message };
		conn.send(JSON.stringify(res));
	});
}

/* Kazik: Funkcja czytająca listę presetów z bazy danych i wysyłająca ją do ComboBoksa na stronie */
var presets = {};
function refreshPresets(conn) {
	presets = {};

	const presetsFolder = './Presety/';
	const fs = require('fs');


	fs.readdirSync(presetsFolder).forEach(file => {
		presets[file] = {
			presetValue: file,
			presetName: file
		}
	});


	let res = { 'id': 'refreshPresets', 'result': presets };
	conn.send(JSON.stringify(res));
}

function connect(conn, params) {
	var device = devices[params.address];
	if (!device) {
		var res = { 'id': 'connect', 'error': 'The specified device is not found: ' + params.address };
		conn.send(JSON.stringify(res));
		return;
	}
	if (params.user) {
		device.setAuth(params.user, params.pass);
	}
	device.init((error, result) => {
		var res = { 'id': 'connect' };
		if (error) {
			res['error'] = error.toString();
		} else {
			res['result'] = result;
		}
		conn.send(JSON.stringify(res));
	});
}

// For Debug --------------------------------------------
//var total_size = 0;
//var start_time = 0;
//var total_frame = 0;
// ------------------------------------------------------

function fetchSnapshot(conn, params) {
	// For Debug --------------------------------------------
	//if(start_time === 0) {
	//	start_time = Date.now();
	//}
	// ------------------------------------------------------
	var device = devices[params.address];
	if (!device) {
		var res = { 'id': 'fetchSnapshot', 'error': 'The specified device is not found: ' + params.address };
		conn.send(JSON.stringify(res));
		return;
	}
	device.fetchSnapshot((error, result) => {
		var res = { 'id': 'fetchSnapshot' };
		if (error) {
			res['error'] = error.toString();
		} else {
			var ct = result['headers']['content-type'];
			var buffer = result['body'];
			var b64 = buffer.toString('base64');
			var uri = 'data:' + ct + ';base64,' + b64;
			res['result'] = uri;

			// For Debug --------------------------------------------
			/*
			total_size += parseInt(result['headers']['content-length'], 10);
			var duration = Date.now() - start_time;
			var bps = total_size * 1000 / duration;
			var kbps = parseInt(bps / 1000);
			total_frame ++;
			var fps = Math.round(total_frame * 1000 / duration);
			console.log(kbps + ' kbps / ' + fps + ' fps');
			*/
			// ------------------------------------------------------
		}
		conn.send(JSON.stringify(res));
	});
}

function ptzMove(conn, params) {
	var device = devices[params.address];
	if (!device) {
		var res = { 'id': 'ptzMove', 'error': 'The specified device is not found: ' + params.address };
		conn.send(JSON.stringify(res));
		return;
	}
	device.ptzMove(params, (error) => {
		var res = { 'id': 'ptzMove' };
		if (error) {
			res['error'] = error.toString();
		} else {
			res['result'] = true;
		}
		conn.send(JSON.stringify(res));
	});
}

function ptzStop(conn, params) {
	var device = devices[params.address];
	if (!device) {
		var res = { 'id': 'ptzStop', 'error': 'The specified device is not found: ' + params.address };
		conn.send(JSON.stringify(res));
		return;
	}
	device.ptzStop((error) => {
		var res = { 'id': 'ptzStop' };
		if (error) {
			res['error'] = error.toString();
		} else {
			res['result'] = true;
		}
		conn.send(JSON.stringify(res));
	});
}

function ptzHome(conn, params) {
	var device = devices[params.address];
	if (!device) {
		var res = { 'id': 'ptzMove', 'error': 'The specified device is not found: ' + params.address };
		conn.send(JSON.stringify(res));
		return;
	}
	if (!device.services.ptz) {
		var res = { 'id': 'ptzHome', 'error': 'The specified device does not support PTZ.' };
		conn.send(JSON.stringify(res));
		return;
	}

	var ptz = device.services.ptz;
	var profile = device.getCurrentProfile();
	var params = {
		'ProfileToken': profile['token'],
		'Speed': 1
	};
	ptz.gotoHomePosition(params, (error, result) => {
		var res = { 'id': 'ptzMove' };
		if (error) {
			res['error'] = error.toString();
		} else {
			res['result'] = true;
		}
		conn.send(JSON.stringify(res));
	});
}

/* Kazik:	Funkcja zapisująca w bazie nowy preset  */

function get_position(conn, params) {

	var device = devices[params.address];
	console.log('get_position: -> (params):');
	console.log(JSON.stringify(params));

	if (!device) {
		var res = { 'id': 'get_position', 'error': 'The specified device is not found: ' + params.address };
		conn.send(JSON.stringify(res));
		return;
	}

	var profile = device.getCurrentProfile();
	var paramss = {
		'ProfileToken': profile['token']
	};

	device.services.ptz.getStatus(paramss).then((result) => {

		var calyStringJSON = result['data'];

		// Zapis nowego presetu w bazie danych:
		var fs = require('fs');
		fs.writeFile('Presety/' + params.presetName, JSON.stringify(calyStringJSON, null, '  '), function (err) { if (err) throw err; console.log('File is created successfully.'); });

		console.log('-------------------->');

		console.log(JSON.stringify(calyStringJSON.GetStatusResponse.PTZStatus.Position.PanTilt.$.x, null, ' '));
		console.log(JSON.stringify(calyStringJSON.GetStatusResponse.PTZStatus.Position.PanTilt.$.y, null, ' '));
		console.log(JSON.stringify(calyStringJSON.GetStatusResponse.PTZStatus.Position.Zoom.$.x, null, ' '));
		console.log('<--------------------');

		refreshPresets(conn); // Po zapisie nowego presetu aktualizujemy zawartość ComboBoksa na stronie klienta

	}).catch((error) => {
		console.error(error);
	});


}

/* Kazik:	Funkcja ustawiająca kamerę wg wybranego w ComboBoksie presetu */
function set_position(conn, params) {

	var device = devices[params.address];

	if (!device) {
		var res = { 'id': 'set_position', 'error': 'The specified device is not found: ' + params.address };
		conn.send(JSON.stringify(res));
		return;
	}

	var fs = require('fs');
	//console.log('^^^^^^^^^^^^^^^^^^^^^');
	//console.log(JSON.stringify(params));
	//console.log('~~~~~~~~~~~~~~~~~~~~~');
	var filePath = 'Presety/' + params.preset;
	//console.log(filePath);
	let rawdata = fs.readFileSync(filePath);

	var calyStringJSON = JSON.parse(rawdata);
	var restoreX = calyStringJSON.GetStatusResponse.PTZStatus.Position.PanTilt.$.x;
	var restoreY = calyStringJSON.GetStatusResponse.PTZStatus.Position.PanTilt.$.y;
	var restoreZ = calyStringJSON.GetStatusResponse.PTZStatus.Position.Zoom.$.x;
	console.log();
	console.log('-------------------->');
	console.log('Przywracamy zapisaną pozycję kamery: x: ' + restoreX + ', y: ' + restoreY + ', z: ' + restoreZ);
	console.log('<--------------------');
	console.log();


	var profile = device.getCurrentProfile();
	//console.log(JSON.stringify(profile, null, ' '));  // tu jest profil kamery - dobrze jest porównać profile kamer od różnych producentów !!!!!!
	var paramss = {
		'ProfileToken': profile['token'],
		'Position': { 'x': parseFloat(restoreX), 'y': parseFloat(restoreY), 'z': parseFloat(restoreZ) },
		'Speed': { 'x': 0.7, 'y': 0.7, 'z': 0.7 }

	};

	device.services.ptz.absoluteMove(paramss).then((result) => {
		//console.log(JSON.stringify(result['data'], null, '  '));
	}).catch((error) => {
		console.error(error);
	});
}

//RADEK
function chatReceiver(conn, data) {
	//var data = JSON.parse(message.utf8Data);
	var method = data['method'];
	var params = data['params'];
	console.log('	Serwer odebrał wiadomość od klienta!');
	console.log('	Method: ' + method);
	console.log('	Params: ' + JSON.stringify(params));
}

function connectToDatabase(conn, params) {
	//wywalone z params.address; być może trzeba będzie do tego wrócić
	var device = devices[params.address];
	if (!device) {
		var res = { 'id': 'database', 'error': 'The specified device is not found: ' + params.address };
		conn.send(JSON.stringify(res));
		return;
	}
	// device.connectToDatabase(params, (error) => {
	// 	var res = { 'id': 'database' };
	// 	if (error) {
	// 		res['error'] = error.toString();
	// 	} else {
	// 		res['result'] = true;
	// 	}
	// 	conn.send(JSON.stringify(res));
	// });

	var res = {};
	mongoose.connect('mongodb://localhost:27017/positions', { useNewUrlParser: true, useUnifiedTopology: true })
		.then(() => {
			console.log("Mongo CONNECTION OPEN!!!")
			res = { 'id': 'database', 'status': 'OK' };
			conn.send(JSON.stringify(res));
		})
		.catch(err => {
			//tutaj trzeba sprawdzić, bo jak baza jest wyłączona, to zwraca OK
			console.log("Oh no! Mongo connection error!");
			console.log(err);
			res = { 'id': 'database', 'status': 'NOK' };
			conn.send(JSON.stringify(res));
		})
}


