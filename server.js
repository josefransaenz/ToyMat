/**
 * ToyMat server file
 */
var http = require("http");                     // require HTTP library
var url = require("url");

function start(route, handle, socketRoute) {	
	 
	// this is the callback function that's called whenever a client makes a request:	
	function respondToClient(request, response) {  	
		var pathname = url.parse(request.url).pathname;
		
		console.log("Http request from: "+ request.connection.remoteAddress + " for " + pathname);		
		
		route(handle, pathname, response, request);
		
	}
	
	var server = http.createServer(respondToClient); // create a server with a callback
	 
	server.listen(8888);          // start the server listening
	// let the user know you started:
	console.log('Server is listening on port 8888');	
	
	return server;
}
exports.start = start;