/**
 * Patient tasks file
 */

"use strict";

var util = require('util')
	, EventEmitter = require('events').EventEmitter
	, exec = require('child_process').exec;

var dataProcessing = require('./dataProcessing')
	, Options = require("options")
	, fs = require('fs');

var defaultProfile = {
	    "name": "Default Name",
	    "lastname": "Default Lastname",
	    "weight": 70,
	    "age": 80
	};
var patientProfile = new Options(defaultProfile); 
var patientFolder;
function loadProfile(pathName, patientProfileFile, cb){
	patientProfile.read(pathName + patientProfileFile, function(err){ // Async
        if(err){ // If error occurs
            console.error("Patient file error.");
        } else{
        	var dataFolder = pathName + '/data';
        	console.error("Checking data folder: " + dataFolder);
        	fs.mkdir(dataFolder, function(err){
				if (err){
					console.error("Data folder error." + err);
				}
				patientFolder = dataFolder + '/' + patientProfile.value.lastname + '_' + patientProfile.value.name;
				console.error("Checking patient folder: " + patientFolder);
	        	fs.mkdir(patientFolder, function(err){
    				if (err){
    					console.error("Patient folder error." + err);
    				}        				
    			});		        
		    });
		} 
        if (typeof cb === 'function'){
        	cb(patientProfile.value);
        }
	});
	
}

function setProfile(data, patientProfileFile){
	patientProfile = patientProfile.merge(data);
	fs.writeFileSync(patientProfileFile, JSON.stringify(patientProfile.value));
}
exports.setProfile = setProfile;

var controllerData = {};
function setControllerData (configData){
	controllerData = configData;
}
exports.setControllerData = setControllerData;

var messages = {
		welcome: "Prima di iniziare il test si assicuri di poter stare comodamente in piede dentro l'area di misura del tappeto",
		start: 'Se desidera iniziare il test dica "avanti" a voce alta oppure prema il pulsante "Avanti"',
		next: "se è pronto per prosseguire dica 'avanti' a voce alta oppure prema il pulsante 'Avanti'",
		tare: "Per effetuare i controlli iniziali per favore esca dall'area di misura",
		ok: "Ok!",
		badWeight: "Il suo peso non corrisponde al suo profilo, vuole andare avanti lo stesso?",
		checkPatient: "Adesso può entrare con i piedi nell'area di misura, si assicuri di avere una sedia dietro di se " +
				"dove si possa sedere senza spostarsi (non si sieda adesso)",
		standStill: "Provi a stare in piedi senza muoversi tenendo le braccia lungo il corpo e la schiena dritta",
		sitDown: "Adesso provi a sedersi",
		standUp: "Adesso provi ad alzarsi in piedi, preferibilmente senza appogiare le mani (se riesce provi a farlo con " +
				"le braccia incrociate)",
		standStillBlind: "Adesso, tenendo gli occhi chiusi, provi a non muoversi tenendo le braccia lungo il corpo e la schiena dritta",
		fixDuration: "Verrà registrata la distribuzione di pressione nell'area impostata durante 30 secondi",
		end: "Il test è finito. Per adesso è tutto, grazie!"
	};

var errMessages = {
		welcome: "init error, no controller data received!",
		tare: "Non è stato possibile rilevare un peso nullo, ripettere o chiamare assistenza",
		repeat: "per ripetere  dica 'avanti' a voce alta oppure prema il pulsante 'Avanti'",
		checkPatient: "Il suo peso non corrisponde al suo profilo",
		standStill: "standStill1 error",
		sitDown: "sit down error",
		standUp: "stand up error",
		standStillBlind: "standStill2 error",	
		fixDuration: "fixDuration error"
};

exports.RUNNING = 0;
exports.COMPLETE = 1;
exports.ERROR = -1;
exports.errMessages = errMessages;
exports.messages = messages;

var counter = 0;
var tic = 0;
function clock(){
	tic = tic + 1;
}
var date = new Date();
var time = date.getTime();

/*----
 * Device specific settings
 */
var chunksPerSecond = 10; //depends of controller sampling frequency
var maxZeroLoad = 3; //maximun expected output at zero load
var weightTolerance = 0.3;// weigth measuring tolerance in %
var maxStd = 4; //maximun standard deviation for considering a stable load
var bufferLength = 3; //size of the load buffer in seconds (this is used for computing the mean and std)

/****************
 * Task constructor
 */
var Task = function(){
	Task.super_.call(this);
	this.RUNNING = 1;
	this.STARTING = 2;
	this.STOP = 0;
	this.ERROR = -1;
	this.timeout = 0; //time out o maximun task duration
	this.delay = 0; //internal timer or minimun task duration
	this.seconds = 0; //task actual duration in seconds 
	this.secondsInterval = {};
	this.state = this.STOP;
	var self = this;
	this.feed = function(data){
		if (self.state === self.STOP){
			return;
		}
		self.emit('data', data);
	};
	this.start = function(){
		setTimeout(function(){
			if (self.state !== self.RUNNING){
				return;
			}
			self.emit('timeout');
		}, self.timeout);
		setTimeout(function(){
			self.emit('start');
		}, self.delay);
		self.secondsInterval = setInterval(function(){
			self.seconds = self.seconds+1;
		}, 1000);
		self.state = self.STARTING;
	};
	this.stop = function(callback){
		self.state = self.STOP;
		clearInterval(self.secondsInterval);
		self.emit('stop', callback);
	};
};
util.inherits(Task, EventEmitter);

/****************
 * PatientTask constructor
 */
var PatientTask = function(messageSender, taskName){
	PatientTask.super_.call(this);
	this.name = taskName;
	
	this.startMessage = {
			message: messages[this.name],
			comment: null,
			progress: null,
			load: null,
			nextButtonEnable: false,
			nextImage: '/images/' + this.name + '.png'
	};
	this.completeMessage = {
			message: messages.ok,
			comment: messages.next,
			progress: null,
			load: null,
			nextButtonEnable: true,
			nextImage: '/images/' + 'ok.png'
	};
	this.errorMessage = {
			message: errMessages[this.name],
			comment: messages.next,
			progress: null,
			load: null,
			nextButtonEnable: true,
			nextImage: '/images/' + 'error.png'
	};
	this.progressMessage = {
			progress: null,
			load: null,
			nextButtonEnable: false,
	};
	if (typeof messageSender === 'function'){	
		messageSender(this.startMessage);	
	} 
};
util.inherits(PatientTask, Task);


/*-------------
 * Welcome task
 * Do nothing, only sending a welcome message
 */
var welcome = function(messageSender, taskName){
	welcome.super_.call(this, messageSender, taskName);
	this.timeout = 1000;
	this.on('start', function(){
		this.state = this.RUNNING;
	});
	this.on('data', function (data){	
		this.startMessage.nextButtonEnable = true;
		this.emit('complete', this.startMessage);
		this.stop();
		var date = new Date();
		console.error('Starting patient test, time: ' + date.getTime());
	});
	this.on('timeout', function (){
		this.emit('error', this.errorMessage);
	});
};
util.inherits(welcome, PatientTask);


/*-------------
 * End task
 * Do nothing, only sending an end message
 */
var end = function(messageSender, taskName){
	end.super_.call(this, messageSender, taskName);
	//this.startMessage.nextButtonEnable = true;
	//this.emit('complete', this.startMessage);
	this.on('data', function (data){	
		this.startMessage.nextButtonEnable = true;
		this.startMessage.nextImage = '/images/' + 'toymat1.png';
		this.emit('complete', this.startMessage);
		this.stop();
	});
};
util.inherits(end, PatientTask);


/*-------------
 * Tare
 * wait
 */
var tare = function(messageSender, taskName){
	tare.super_.call(this, messageSender, taskName);
	this.timeout = 10000;
	this.delay = 2000;
	this.totalLoadBuffer = new Uint16Array(chunksPerSecond*bufferLength);
	this.chunks = 0;
	this.on('start', function(){
		this.state = this.RUNNING;
		console.error('Tare task begin');
	});
	this.on('data', function (frame){		
		var load = frame.load;
		this.totalLoadBuffer = dataProcessing.shiftLeft(this.totalLoadBuffer, load);
		this.chunks++;
		if (this.state !== this.RUNNING) {return;}
		var meanLoad = dataProcessing.mean(this.totalLoadBuffer);
		var stdLoad = dataProcessing.std(this.totalLoadBuffer);
		if (meanLoad < maxZeroLoad && stdLoad < maxStd){
			this.emit('complete', this.completeMessage);
			console.error('Tare task end ok');
			this.stop();
		} else{
			this.progressMessage.progress = Math.round(this.seconds/this.timeout*100000);
			this.progressMessage.load = meanLoad;
			this.progressMessage.comment = this.progressMessage.progress.toString() + ' std: '+stdLoad.toString();
			this.emit('progress', this.progressMessage);
		}
	});
	this.on('timeout', function (){
		this.emit('error', this.errorMessage);
		console.error('Tare task end timeout');
		this.stop();
	});
};
util.inherits(tare, PatientTask);

/*-------------
 * checkPatient
 * addEventListener "fullWeight" to do something once average output is more than a threshold and is stable
 */
var checkPatient = function(messageSender, taskName){
	checkPatient.super_.call(this, messageSender, taskName);
	this.timeout = 10000;
	this.delay = 2000;
	this.totalLoadBuffer = new Uint16Array(chunksPerSecond*bufferLength);
	this.maxChunks = this.timeout*chunksPerSecond/1000;
	this.chunks = 0;	
	this.minLoad = patientProfile.value.weight*(1 - weightTolerance);
	this.maxLoad = patientProfile.value.weight*(1 + weightTolerance);
	this.ending = false;

	this.on('start', function(){
		this.state = this.RUNNING;
		console.error('checkPatient task begin');
	});
	this.on('data', function (frame){
		var load = frame.load;
		this.totalLoadBuffer = dataProcessing.shiftLeft(this.totalLoadBuffer, load);		
		if (this.state !== this.RUNNING) {return;}
		var meanLoad = dataProcessing.mean(this.totalLoadBuffer);
		var stdLoad = dataProcessing.std(this.totalLoadBuffer);
		if (meanLoad > this.minLoad && !this.ending){// && meanLoad < this.maxLoad && stdLoad < maxStd){			
			this.ending = true;
			var self = this;
			setTimeout(function(){
				self.emit('complete', self.completeMessage);
				self.stop();
				self.ending = false;
				console.error('checkPatient task end ok');
			}, 3000);//delay for stabilization
		} else{
			this.progressMessage.progress = Math.round(this.seconds/this.timeout*100000);
			this.progressMessage.load = meanLoad;
			//this.progressMessage.comment = "min: "+this.minLoad.toString()+" max: "+this.maxLoad.toString()+" std: "+stdLoad.toString();
			this.emit('progress', this.progressMessage);
		}
	});
	this.on('timeout', function (){		
		this.emit('error', this.errorMessage);
		this.stop();
		console.error('checkPatient task end timeout');
	});
};
util.inherits(checkPatient, PatientTask);

/*-------------
 * standStill1
 * addEventListener "fullWeight" to do something once average output is more than a threshold and is stable
 */

var standStill = function(messageSender, taskName){
	standStill.super_.call(this, messageSender, taskName);
	this.timeout = 30000;
	this.delay = 0;
	this.totalLoadBuffer = new Uint16Array(chunksPerSecond*bufferLength);
	this.maxChunks = this.timeout*chunksPerSecond/1000;
	this.chunks = 0;	
	this.minLoad = patientProfile.value.weight*(1 - weightTolerance);
	this.maxLoad = patientProfile.value.weight*(1 + weightTolerance);
	this.quadLoad = new Uint16Array(4);
	var date = new Date();
	this.fileName = '/' + this.name + '_' + date.getTime() + '.JSON';	
	var self = this;
	this.saving = false;
	this.folder = patientFolder + '/' + this.name;
	fs.exists(this.folder, function (exists) {
		if (!exists){
			fs.mkdirSync(self.folder);
		}
		self.fd = fs.openSync(self.folder + self.fileName, 'w');
		self.writestream = fs.createWriteStream(self.folder + self.fileName, {encoding: 'utf8', fd: self.fd});
		self.saving = true;
	});	
	
	this.on('start', function(){
		var message2send = this.progressMessage;
		message2send.comment = "Iniziando misura in: 3 secondi...";
		this.emit('progress', message2send);
		setTimeout(function(){
			message2send.comment = "Iniziando misura in: 2 secondi...";
			self.emit('progress', message2send);
		}, 1000);
		setTimeout(function(){
			message2send.comment = "Iniziando misura in: 1 secondi...";
			self.emit('progress', message2send);
		}, 2000);
		setTimeout(function(){
			message2send.comment = "Iniziando misura in: 0 secondi...";
			self.emit('progress', message2send);
			self.writestream.write('{"controllerData":' + JSON.stringify(controllerData) + ', "frames":[');
			self.state = self.RUNNING;
		}, 3000);
		console.error('standStill task begin');
	});
	
	this.on('data', function (frame){
		if (this.state !== this.RUNNING) {return;}		
		
		if (this.chunks === 0){
			self.writestream.write(JSON.stringify(frame));
		} else {
			self.writestream.write(',' + JSON.stringify(frame));
		}
		console.error('f_saved');
		
		this.chunks++;
		var message2send = this.progressMessage;		
		var load = frame.load;
		var progress = Math.round(this.seconds/this.timeout*100000);		
		message2send.progress = progress;
		message2send.load = load;
		message2send.comment = "Misurando...";
		message2send.quadMean = frame.quadMean;
		this.emit('progress', message2send);
	});
	
	this.on('timeout', function (){
		this.emit('complete', this.completeMessage);
		if (!self.saving) { return;}
		self.writestream.end('],"length":' + this.chunks + '}');
		self.saving = false;
		this.stop();
		console.error('standStill task end');
				
	});
	
	this.on('stop', function (){
		if (!self.saving) { return;}
		self.writestream.end('],"length":' + this.chunks + '}');
		self.saving = false;
		console.error('standStill error');
		var file2erase = self.folder + self.fileName;
		exec('rm ' + file2erase, function(err, stdout, stderr) {
			if (err){
				console.error('error removing file: ' + file2erase + '. Error code: '+ err.code);
				return;
			}
			console.error('Task file removed. Details: ' + stdout);
		});
	});
	
};
util.inherits(standStill, PatientTask);


/*-------------
 * sitDown
 * wait
 */
var sitDown = function(messageSender, taskName){
	sitDown.super_.call(this, messageSender, taskName);
	this.maxSitLoad = patientProfile.value.weight*(0.1);
	this.on('data', function (frame){
		if (this.state !== this.RUNNING) {return;}
		var meanLoad = dataProcessing.mean(this.totalLoadBuffer);
		var stdLoad = dataProcessing.std(this.totalLoadBuffer);
		if (meanLoad < this.maxSitLoad && stdLoad < maxStd){
			this.emit('complete', this.completeMessage);
			this.stop();
			console.error('sitDown task end');
		} 
	});
};
util.inherits(sitDown, tare);

/*-------------
 * standUp
 * addEventListener "fullWeight" to do something once average output is more than a threshold and is stable
 */
var standUp = function(messageSender, taskName){
	checkPatient.call(this, messageSender, taskName);
	var date = new Date();
	this.fileName = '/' + this.name + '_' + date.getTime() + '.JSON';	
	var self = this;
	this.saving = false;
	this.folder = patientFolder + '/' + this.name;
	fs.exists(this.folder, function (exists) {
		if (!exists){
			fs.mkdirSync(self.folder);
		}
		self.fd = fs.openSync(self.folder + self.fileName, 'w');
		self.writestream = fs.createWriteStream(self.folder + self.fileName, {encoding: 'utf8', fd: self.fd});
		self.writestream.write('{"controllerData":' + JSON.stringify(controllerData) + ', "frames":[');
		self.saving = true;
	});
	
	this.on('data', function (frame){
		//save data
		if (this.state !== this.RUNNING) {return;}
		
		if (this.chunks === 0){
			self.writestream.write(JSON.stringify(frame));
		} else {
			self.writestream.write(',' + JSON.stringify(frame));
		}
		console.error('f_saved');
		this.chunks++;
		this.progressMessage.comment = "Misurando...";
		this.emit('progress', this.progressMessage);
	});
	
	this.on('complete', function(){
		if (!self.saving) { return;}
		self.writestream.end('],"length":' + this.chunks + '}');
		self.saving = false;
	});
	
	this.on('timeout', function(){
		if (!self.saving) { return;}
		self.writestream.end('],"length":' + this.chunks + '}');
		self.saving = false;
	});
	
	this.on('stop', function (){
		if (!self.saving) { return;}
		self.writestream.end('],"length":' + this.chunks + '}');
		self.saving = false;
		console.error('standUp error');
		var file2erase = self.folder + self.fileName;
		exec('rm ' + file2erase, function(err, stdout, stderr) {
			if (err){
				console.error('error removing file: ' + file2erase + '. Error code: '+ err.code);
				return;
			}
			console.error('Task file removed. Details: ' + stdout);
		});
	});
	
};
util.inherits(standUp, checkPatient);

/*-------------
 * standStillBlind
 * addEventListener "fullWeight" to do something once average output is more than a threshold and is stable
 */
//var patientFolder = '/' + patientProfile.lastName + patientProfile.name + "_Files";
var standStillBlind = function(messageSender, taskName){
	standStill.call(this, messageSender, taskName);
};
util.inherits(standStillBlind, standStill);

/*-------------
 * fixDuration
 * addEventListener "fullWeight" to do something once average output is more than a threshold and is stable
 */
//var patientFolder = '/' + patientProfile.lastName + patientProfile.name + "_Files";
var fixDuration = function(messageSender, taskName){
	standStill.call(this, messageSender, taskName);
	this.timeout = 30000;
};
util.inherits(fixDuration, standStill);

exports.loadProfile = loadProfile;
exports.welcome = welcome;
exports.end = end;
exports.tare = tare;
exports.checkPatient = checkPatient;
exports.standStill = standStill;
exports.sitDown = sitDown;
exports.standUp = standUp;
exports.standStillBlind = standStillBlind;
exports.fixDuration = fixDuration;