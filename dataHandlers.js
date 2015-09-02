/**
 * ToyMat dataHandlers file
 */
"use strict";

var util = require('util')
	, stream = require('stream')
	, fs = require('fs');
var patientTasks = require('./patientTasks');
var dataProcessing = require('./dataProcessing');
var matController = require("./matController");
var toymat = new matController();

var pathName = "/mnt/sda1/toymat";
//var pathName = ".";
exports.pathName = pathName;

var configFile = '/configFile.JSON';
var patientProfileFile = '/patientProfile.JSON';

toymat.readConfigData(pathName + configFile);

function configController(data){	
	var configData = {};
	for (var x in data) {
		configData[x] = parseInt(data[x]);
	}
	if (configData.xn > 32 || configData.yn > 32 || configData.xn < configData.x0 || configData.yn < configData.y0){
		console.error('invalid area: ' + configData.x0 + ',' + configData.y0 + ' to ' + configData.xn + ', ' + configData.yn);
		return false;
	}
	console.error('setting new acquisition area: ' + configData.x0 + ',' + configData.y0 + ' to ' + configData.xn + ', ' + configData.yn);
	toymat.writeConfigData(configData, pathName + configFile);
}

function getConfigData(cb){
	toymat.readConfigData(pathName + configFile, cb);
}

function setPatient(data){
	patientTasks.setProfile(data, pathName + patientProfileFile);
}
exports.setPatient = setPatient;

function getPatient(cb){
	patientTasks.loadProfile(pathName, patientProfileFile, cb);
}
exports.getPatient = getPatient;

function equilibrate(area2equilibrate, cb){
	if (!patientOnline && clientStreams.length() === 0){
		patientOnline = true;
		toymat.equilibrateSensors(area2equilibrate.x0, area2equilibrate.y0, area2equilibrate.xn, area2equilibrate.yn);
		
		toymat.once('idle', function(){
			patientOnline = false;
			if (typeof cb === 'function'){
				cb();
			}
		});
	}
}


function tare(cb){
	if (!patientOnline && clientStreams.length() === 0){
		patientOnline = true;
		var bufferLength = 30;
		var sum = 0;
		var cont = 0;
		var n;
		var maxArray = new Array(toymat.dimension);
		maxArray = dataProcessing.initArray(maxArray, 10);
		console.error('Tare request');
		toymat.start();
		toymat.dataStream.on('data', function(chunk) {			
			sum += toymat.frame.mean;
			for (n = 0; n < maxArray.length; n++){
				if (maxArray[n] < toymat.frame.array[n]){
					maxArray[n] = toymat.frame.array[n];
				}
        	}			
	        cont++;
	        if (cont === bufferLength){
	        	toymat.dataStream.removeAllListeners('data');
	        	toymat.stop();
	        	sum /= bufferLength;
	        	var maxx=0;
	        	for (n = 0; n < maxArray.length; n++){
	        		maxArray[n] = Math.ceil(maxArray[n] * 1.2);
	        		if (maxx < maxArray[n]){
	        			maxx = maxArray[n];
	        		}
	        	}
	        	console.error('max tare value: ' + maxx.toString());
	        	toymat.writeConfigData({"calibrationOffset": sum, "maxZeroFrame": maxArray}, pathName + configFile);
	        	patientOnline = false;
				if (typeof cb === 'function'){
					cb();
				}
	        }			
		});
	}
}
exports.tare = tare;

function calibrate(data, cb){
	var calibrationWeight = parseInt(data.calibrationWeight);
	if (!patientOnline && clientStreams.length() === 0){
		patientOnline = true;
		var bufferLength = 30;
		var sum = 0;
		var cont = 0;
		console.error('Calibration request');
		toymat.start();
		toymat.dataStream.on('data', function(chunk) {			
			sum += (toymat.frame.mean - toymat.calibrationOffset) * Math.sqrt(toymat.frame.activePixels);
	        cont++;
	        if (cont === bufferLength){
	        	toymat.dataStream.removeAllListeners('data');
	        	toymat.stop();
	        	sum /= bufferLength;
	        	toymat.writeConfigData({"calibrationWeight": calibrationWeight, "calibrationOutput": sum}, pathName + configFile);
	        	patientOnline = false;
				if (typeof cb === 'function'){
					cb();
				}
	        }			
		});
	}
}
exports.calibrate = calibrate;

function getEquilibration(){
	if (!patientOnline && clientStreams.length() === 0){
		toymat.getEquilibration(pathName + configFile);
	}
}
exports.getEquilibration = getEquilibration;

function setEquilibration(){
	if (!patientOnline && clientStreams.length() === 0){
		toymat.setEquilibration(pathName + configFile);
	}
}
exports.setEquilibration = setEquilibration;

var actions = {
		"checkProtocol" : 0,
		"start" : 1,
		"nextStep" : 2,
		"stop" : 3,
		"end" : 4
};

var sequence = {
		step0: 'welcome',
		step1: 'tare',//no action, wait button next
		step2: 'checkPatient',//auto start, detect weight increase, auto call next (timeouts and msg if not stable)
		step3: 'standStill',//auto start after 3 secs, counter 5 secs, auto call next
		step4: 'sitDown',//auto start, detect weight decrease, auto call next (timeouts and msg if not stable)
		step5: 'standUp',//auto start, detect weight increase, auto call next (timeouts and msg if not stable)
		step6: 'standStillBlind',//auto start after 3 secs, counter 5 secs, auto call next
		step7: 'end',
		last: 8
};

var patientOnline = false;
var testStep = 0;
var patientStream = {};
var taskReady = true;
var cont = 0;
var task = {};

function fitTest0(action, ws){
	function messageSender(message){
		ws.send(JSON.stringify(message), function() { });
	}
	switch(actions[action]) {
	case actions["checkProtocol"]://entry message
		if (!patientOnline){
			patientOnline = true;
			console.log("opening patient session");
			patientTasks.loadProfile(pathName, patientProfileFile);
			return true;
		} else {
			console.log("refusing a patient request");
			return false;
		}
		break;
	case actions["start"]:
		console.log("starting patient session");		
		break;	
	case actions["nextStep"]:
		console.log("next step: " + testStep.toString());			
		var taskName = sequence['step' + testStep.toString()];		
		task = new patientTasks[taskName](messageSender, taskName);		
				
		toymat.dataStream.on('data', function(chunk) {			
			task.feed(toymat.frame);
		});
		
		task.on('complete', function(message){			
			toymat.dataStream.removeAllListeners('data');
			toymat.removeAllListeners('idle');
			toymat.stop();
			messageSender(message);
			testStep++;
			if (testStep === sequence.last){
				testStep = 0;			
			}	
		});
		
		task.on('progress', function(message){
			messageSender(message);
		});
		
		task.on('error', function(message){			
			toymat.dataStream.removeAllListeners('data');
			toymat.removeAllListeners('idle');
			toymat.stop();
			messageSender(message);
		});
		
		task.start();
		toymat.start();
		toymat.once('idle', function(){
			toymat.dataStream.removeAllListeners('data');
			console.error('Data overflow!');
			task.stop();
			var message = {
					message: 'Controller error',
					comment: "Data overflow",
					progress: null,
					load: null,
					nextButtonEnable: true,
					nextImage: null
			};
			messageSender(message);
		});
			 
		break;	
	case actions["stop"]:
		console.log("ending patient session");
		toymat.dataStream.removeAllListeners('data');
		toymat.removeAllListeners('idle');
		if (task.state === task.RUNNING && task.stop !== undefined) {
			task.stop();
			toymat.stop();
		} 				
		if (ws.readyState === ws.OPEN){
			testStep = sequence.last-1;
			setTimeout(function(){
				var message2send = {
						message : patientTasks.messages[sequence['step' + testStep.toString()]],
						nextButtonEnable : true,
						progress : null,
						load : null,
						comment : patientTasks.messages.next,
					};
				ws.send(JSON.stringify(message2send), function() { });
			}, 1000);
		} else{
			testStep = 0;
			patientOnline = false;
		}
		break;
	}	
	return true;
}

var transforms = {};
transforms["fullMatrix"] = function(chunk){
	return chunk;
	};
	
var output = new Int16Array(1);
transforms["meanOutput"] = function(chunk){
	output[0] = toymat.frame.load;//toymat.frame.mean;//dataProcessing.mean(frame.array);
	output.activePixels = toymat.frame.activePixels;	
	output.dt = toymat.frame.dt;
	return output;
	
};

var output4 = new Int16Array(4);
transforms["quadMeanOutput"] = function(chunk){
	for (var j = 0; j < 4; j++){          
		output4[j] = toymat.frame.quadMean[j];
	}
	output4.activePixels = toymat.frame.activePixels;
	output4.dt = toymat.frame.dt;
	//console.error(JSON.stringify(output4));
	return output4;
};

function realTimeStream (sendFunction, transformFunction) { // step 2
  stream.Writable.call(this);
  this.sendFunction = sendFunction;
  this.transformFunction = transformFunction;
}
util.inherits(realTimeStream, stream.Writable); // step 1
realTimeStream.prototype._write = function (chunk, encoding, done) { // step 3	
	if (chunk !== null){
		this.sendFunction.send(JSON.stringify(this.transformFunction(chunk)), function() { });
	}		
	done();
};
var clientStreams = {};
clientStreams.length = function(){
	var len = 0; 
	var obj;
	for (obj in this){
		if (typeof this[obj] === 'object'){
			len++;
		}
	}
	return len;
};

function realTimeStreaming(action, websocket){
	var errorListener = function(){
		console.error('Data overflow!');
		if (websocket.readyState === websocket.OPEN){
			var message = {"msg" : 'E'};
			websocket.send(JSON.stringify(message));
		}
	};	
	switch(actions[action]) {
		case actions["checkProtocol"]:
			return true;
			break;
		case actions["getSpecs"]:
			console.log("sending controller specs.");
			websocket.send(JSON.stringify(toymat.configData.value), function() { });
			break;
		case actions["start"]:
			if (websocket !== undefined && websocket.clientID !== undefined && clientStreams[websocket.clientID.toString()] === undefined){
				clientStreams[websocket.clientID.toString()] = new realTimeStream(websocket, transforms[websocket.protocol]); // instanciate your brand new stream
			}
			if (clientStreams[websocket.clientID.toString()] !== undefined){
				console.log("starting support stream: " + websocket.clientID.toString());				
				toymat.dataStream.pipe(clientStreams[websocket.clientID.toString()]);
				if (clientStreams.length() === 1 && !patientOnline){
					toymat.start();
					toymat.once('idle', errorListener);
				}								
			}					
			break;
		case actions["stop"]:
			if (clientStreams[websocket.clientID.toString()] !== undefined){
				var endStream = function() {
					toymat.dataStream.unpipe(clientStreams[websocket.clientID.toString()]);
					delete clientStreams[websocket.clientID.toString()];
					console.log("ending support stream: " + websocket.clientID.toString() + ' remaining streams: '+ clientStreams.length());
					if (websocket.readyState === websocket.OPEN){
						var message = {"msg" : 'S'};
						websocket.send(JSON.stringify(message));
					}					
				};
				if (clientStreams.length() === 1  && !patientOnline){
					toymat.removeAllListeners('idle');				
					toymat.stop(endStream);					
				} else{
					process.nextTick(endStream);
				}				
			}			
			break;	
	}	
}

var taskMeasures = {
		standStill: {m1: "Bilancio destra/sinistra", m2: "Bilancio fronte/retro", m3: "Peso stimato"},
		standUp: {m1: "Bilancio destra/sinistra", m2: "Bilancio fronte/retro", m3: "Durata stimata"},
		standStillBlind: this.standStill
}

var taskUnits = {
		standStill: {m1: "%", m2: "%", m3: "kg"},
		standUp: {m1: "%", m2: "%", m3: "s"},
		standStillBlind: this.standStill
}

var patientFolder;
var taskFolder;
function readFiles(action, websocket){
	var message = {};
	if (actions[action] === actions.checkProtocol){
		return true;
	}
	if (action.task === null){
		getPatient(function(patientData){
			patientFolder = pathName + '/' + patientData.lastname + patientData.name + "_Files";
			message = {"patientData" : patientData, "tasks": ["standStill", "standUp", "standStillBlind"]};
			websocket.send(JSON.stringify(message));
			console.log("sending patient data to caregiver...");
			taskFolder = undefined;
		});
	} else if (action.file === null){
		if (patientFolder === undefined) {return;}
		taskFolder = patientFolder + '/' + action.task;
		fs.readdir(taskFolder, function (err, files) {
    		if (err){
    			message = {"error" : "No data for task: " + action.task};
    			websocket.send(JSON.stringify(message));
    			return;
    		}
    		message = {"files" : files};
			websocket.send(JSON.stringify(message));
			console.log("sending task data to caregiver...");
		});
	} else if (action.file !== undefined && action.file !== null){
		if (taskFolder === undefined) {return;}
		fs.readFile(taskFolder + '/' + action.file, function (err, data) {			
			if (err){
				var message = {"error" : "No data for file: " + action.file};
				websocket.send(JSON.stringify(message));
				console.error('Error reading task file' + action.file);
				return;
			}
			websocket.send(JSON.stringify(JSON.parse(data)));
			console.log("sending task file: " + action.file + " to caregiver...");
		});		
	}		
}

exports.equilibrate = equilibrate;
exports.fitTest0 = fitTest0;
exports.readFiles = readFiles;
exports.realTimeStreaming = realTimeStreaming;
exports.configController = configController;
exports.getConfigData = getConfigData;
exports.equilibrate = equilibrate;

