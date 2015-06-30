/**
 * ToyMat request Handlers 
 */
var fs = require("fs");
var querystring = require("querystring");
var dataHandlers = require("./dataHandlers");
var pathName = dataHandlers.pathName;

function support(response, request) {
	if (request.method === 'POST') {
		 request.setEncoding('utf8');
		 request.on('data', function(chunk) {
			// there is some data to read now
			var data = querystring.parse(chunk);
			if (data.rows !== undefined){
				dataHandlers.configController(data);
			} else if (data.name !== undefined){
				dataHandlers.setPatient(data);
			} else if (data.tare !== undefined){
				dataHandlers.tare();
			} 
		 });
	 }
	dataHandlers.getPatient(function(patientData){
		dataHandlers.getConfigData(function(configData){
			var rowsId = 'r' + configData.rows.toString();
			var columnsId = 'c' + configData.columns.toString();
			var eqThId = 'eqTh';
			var gainId = 'g' + configData.pgaGain.toString();
			var p1Id = 'p1';
			var p2Id = 'p2';
			var q1Id = 'q1';
			var head = '<!DOCTYPE html>'+
			'<html>'+
			'<head>'+
				'<meta charset="ISO-8859-1">'+
				'<title>ToyMat support</title>'+
				'<meta name="viewport" content="width=device-width, initial-scale=1">'+
				'<link rel="stylesheet" href="/bootstrap-3.3.4-dist/css/bootstrap.min.css">'+ 
				'<script>'+'\n'+
				'function myFunction() {'+'\n'+
					'document.getElementById("serial").innerHTML = "'+configData.serialNumber+'";'+'\n'+
					'var rowId = document.getElementById("'+rowsId+'");'+'\n'+
					'rowId.checked="checked";'+'\n'+
					'var colId = document.getElementById("'+columnsId+'");'+'\n'+
					'colId.checked="checked";'+'\n'+
					'var eqThId = document.getElementById("'+eqThId+'");'+'\n'+
					'eqThId.value='+configData.eqThreshold.toString()+';'+'\n'+
					'var gainId = document.getElementById("'+gainId+'");'+'\n'+
					'gainId.checked="checked";'+'\n'+
					'var p1Id = document.getElementById("'+p1Id+'");'+'\n'+
					'p1Id.value='+configData.p1.toString()+';'+'\n'+
					'var p2Id = document.getElementById("'+p2Id+'");'+'\n'+
					'p2Id.value='+configData.p2.toString()+';'+'\n'+
					'var q1Id = document.getElementById("'+q1Id+'");'+'\n'+
					'q1Id.value='+configData.q1.toString()+';'+'\n'+
					'$("#name").val("' + patientData.name + '");'+
					'$("#lastname").val("' + patientData.lastname + '");'+
					'$("#weight").val("' + patientData.weight.toString() + '");'+
					'$("#age").val("' + patientData.age.toString() + '");'+
				'}'+'\n'+
				'</script>'	+'\n'+
			'</head>';
			response.writeHead(200, {"Content-Type": "text/html"}); 
			response.write(head);
			fs.createReadStream(pathName + '/www' + "/support.html").pipe(response);
		});	
	});
}

function equilibrate(response, request) {
	var htmlMessage = '<!DOCTYPE html>'+
	'<html>'+
	'<head>'+
		'<meta charset="ISO-8859-1">'+
		'<title>ToyMat equilibration</title>'+
	'</head>'+
	'<body>'+
		'<h2> Equilibrating sensors, please wait...</h2>';
	var endHtml = '<br>'+
		'<h3> Equilibration Done!</h3>'+
		'<form action="/support" method="get">'+       
			'<input type="submit" value="Return to support page">'+
		'</form>'+
	'</body>'+
	'</html>';
	if (request.method === 'POST') {
		 request.setEncoding('utf8');
		 request.on('data', function(chunk) {
			 // there is some data to read now
			 response.writeHead(200, {"Content-Type": "text/html"}); 
			 response.write(htmlMessage);
			 var progress = setInterval(function(){
				 response.write('.');
			 }, 500);					
			 dataHandlers.equilibrate(querystring.parse(chunk), function(){
				 clearInterval(progress);
				 response.write(endHtml);
				 response.end();
			 });
		 });
	 }
}

function calibrate(response, request) {
	var htmlMessage = '<!DOCTYPE html>'+
	'<html>'+
	'<head>'+
		'<meta charset="ISO-8859-1">'+
		'<title>ToyMat calibration</title>'+
	'</head>'+
	'<body>'+
		'<h2> Calibrating, please wait...</h2>';
	var endHtml = '<br>'+
		'<h3> Calibration Done!</h3>'+
		'<form action="/support" method="get">'+       
			'<input type="submit" value="Return to support page">'+
		'</form>'+
	'</body>'+
	'</html>';
	if (request.method === 'POST') {
		 request.setEncoding('utf8');
		 request.on('data', function(chunk) {
			 // there is some data to read now
			 response.writeHead(200, {"Content-Type": "text/html"}); 
			 response.write(htmlMessage);
			 var progress = setInterval(function(){
				 response.write('.');
			 }, 500);					
			 dataHandlers.calibrate(querystring.parse(chunk), function(){
				 clearInterval(progress);
				 response.write(endHtml);
				 response.end();
			 });
		 });
	 }
}

function streamdata(response, request) {
	response.writeHead(200, {"Content-Type": "text/html"});  
	fs.createReadStream(pathName + '/www' + "/streamdata.html").pipe(response);
}

function patient(response, request) {
	//console.log("sending script stream");	
	response.writeHead(200, {"Content-Type": "text/html"});  
	fs.createReadStream(pathName + '/www' + "/patient.html").pipe(response);	
}

function caregiver(response, request) {
	//console.log("sending script stream");	
	response.writeHead(200, {"Content-Type": "text/html"});  
	fs.createReadStream(pathName + '/www' + "/caregiver.html").pipe(response);
}

function sendFile(response, fileName) {
	function notFound(file){
		console.log("No file found for " + file);
		response.writeHead(404, {"Content-Type": "text/html"});  
		response.write("404 Not found");
		response.end();
	}
	var head = {};
	if (fileName.search(".html") >= 0){
		head = {"Content-Type": "text/html"};  
	} else if (fileName.search(".js") >= 0){
		head = {"Content-Type": "text/javascript"};  
	} else if (fileName.search(".css") >= 0){
		head = {"Content-Type": "text/css"};  
	} else if (fileName.search(".png") >= 0){
		head = {"Content-Type": "image/png"};  
	} else if (fileName.search(".gif") >= 0){
		head = {"Content-Type": "image/gif"};  
	} else {
		notFound(fileName);
		return;
	}
	var publicPathName = pathName + '/www' + fileName;
	fs.open(publicPathName, 'r', function(err, fd){
		if(err){
			notFound(fileName);
			return;
		} else{
			response.writeHead(200, head);  
			fs.createReadStream(publicPathName, {fd: fd}).pipe(response);
		}		
	});		
}


exports.support = support;
exports.streamdata = streamdata;
exports.equilibrate = equilibrate;
exports.calibrate = calibrate;
exports.patient = patient;
exports.caregiver = caregiver;
exports.sendFile = sendFile;
