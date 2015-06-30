/**
 * ToyMat socket Server
 */
var WebSocketServer = require('ws').Server;
var url = require("url");

var maximumClients = 9;
function start(server, socketHandle) {
	var clientes = 0;
	var clientIDs = 0;
	function verifyClient(info){//},  cbend){
		var pathname = url.parse(info.req.url).pathname;
		console.log('WebSocket request from: ' + info.origin + ' for: ' + pathname);
		//cbend(false, 403, 'Forbidden because there is already a patient');
		if (clientes < maximumClients){
			return true;
		} else {
			console.log('Connection refused, maximum clients reached');
			return false;
		}
	}
	function handleProtocols(protocols, cb){//},  cbend){
		console.log('protocols: '+ protocols);
		if (typeof socketHandle[protocols] === 'function'){
			if (socketHandle[protocols]('checkProtocol')){ //check protocol entry
				cb(true, protocols);
			}
		}		
	}
	var wss = new WebSocketServer({server: server, verifyClient: verifyClient, handleProtocols: handleProtocols});
	wss.on('connection', function(ws) {
		console.log("\n"+'clients: ' + wss.clients.length);
		var d = new Date();
		ws.clientID = d.getTime();
		console.log('started client: ' + ws.clientID.toString() + "\n");
				
		ws.on('message', function incoming(message) {			
			var command = JSON.parse(message); //message = {"action" : y}
			socketHandle[ws.protocol](command.action, ws);		
		});
		
		ws.on('close', function(code, message) {
			console.log("\n closing code:" + code.toString() + " msg: " + message);			
			console.log('stopping client: ' + ws.clientID.toString() + "\n");	
			socketHandle[ws.protocol]('stop', ws);
			//ws.terminate();
		});
	});
}
exports.start = start;