/**
 * ToyMat matController file
 */
//"use strict";
var util = require('util')
	, EventEmitter = require('events').EventEmitter
	, stream = require('stream')
	, Options = require("options")
	, dataProcessing = require('./dataProcessing')
	, fs = require('fs');

var matController = function (configData){
	var defaultConfigData = {
		serialNumber: 'TYMT001',
		x0: 0,
		y0: 0,
		xn: 32,
		yn: 32,
		eqThreshold : 247, // desired digital output
							 // better if it's equal to pressure in kPa, 
							 // must have three chars from 000 to 999		
		pgaGain : 1, //gain parameter for PGA, single char '1' means gain x2 (see PGA datasheet)
		endBytes : 2, //number of bytes at the end of each frame, 2 = dt + newLine char
		saveRaw : "0",
		p1: 644,
		p2: 2465,
		q1: 80,
		calibrationWeight: 1,
		calibrationOutput: 1,
		calibrationOffset: 0,
		maxZeroFrame: new Array(1024),
		equilibrationFrame: new Array(1024)
	};	
	defaultConfigData.maxZeroFrame = dataProcessing.initArray(defaultConfigData.maxZeroFrame);
	defaultConfigData.equilibrationFrame = dataProcessing.initArray(defaultConfigData.equilibrationFrame, 255);
	// Create an option object with default value 
    this.configData = new Options(defaultConfigData);
    
    this._setSize = function(){
    	this.columns = this.configData.value.xn - this.configData.value.x0;
    	this.rows = this.configData.value.yn - this.configData.value.y0;
    	this.endBytes = this.configData.value.endBytes;
    	this.dimension = this.rows*this.columns;
    	this.frameSize = this.dimension + this.endBytes;
    	this.calibrationOffset = this.configData.value.calibrationOffset;
    	this.calibrationFactor = this.configData.value.calibrationWeight / this.configData.value.calibrationOutput;
    	this.p1 = this.configData.value.p1;
		this.p2 = this.configData.value.p2;
		this.q1 = this.configData.value.q1;
    };
    this._setSize();
    
    var states = {
    		idle : '#',
    		acquiring : "'",
    		equilibrating : "%",
    		unknown : '&',
    		stopNode : "!"
    		};
    this.state = states.unknown;
    
	this._write = function(data){
		process.stdout.write(data + '\n');
	};
	this._commandstr = {
			stop : "!",
			start : "$~1",
			equilibrate : "$~2",
			getEquilibration : "$~3",
			acknowledge : "%",
			badFrame : "$~4",
			getState : "$~5",
			setEquilibration : "$~6",
			setArea : "$~7",
	};
	this._configstr = {
			rows : "$#r",
			columns : "$#c",
			eqThreshold : "$#e",
			bytes : "$#b",
			pgaGain : "$#g",
			eqX0 : "$#x",
			eqY0 : "$#y",
			eqXn : "$#X",
			eqYn : "$#Y",
	};
	this.getState = function(){
		self.state = states.unknown;
		self._write(self._commandstr.getState);
	};
	
	var self = this;
	this._setConfigData = function(){
		self._write(self._configstr.eqX0 + self.configData.value.x0);
		self._write(self._configstr.eqXn + self.configData.value.xn);
		self._write(self._configstr.eqY0 + self.configData.value.y0);
		self._write(self._configstr.eqYn + self.configData.value.yn);
		self._write(self._configstr.eqThreshold + self.configData.value.eqThreshold);
		self._write(self._configstr.pgaGain + self.configData.value.pgaGain);
	};
	this._setConfigData();
	
	this.readConfigData = function(filename, cb){
		self.configData.read(filename, function(err){ // Async
            if(err){ // If error occurs
                console.log("Config file error.");
	        }else{
	        	self._setConfigData();
	        	console.error('config: ' + JSON.stringify(self.configData.value));
	        	self._setSize();
	        }
            if (typeof cb === 'function'){
            	cb(self.configData.value);
            }
    	});
    };
	this.writeConfigData = function(configData, filename){
		self.configData = self.configData.merge(configData);
		self._setConfigData();
		self._setSize();
		fs.writeFileSync(filename, JSON.stringify(self.configData.value));
	};
	
	this.frame = {
			array: [],
			rows: 0,
			columns: 0,
			raw: 0,
			dt: 0,
			mean: 0,
			load: 0,
			count: 0,
			quadMean: new Array(4),
			activePixels: 0
	};
	this.chunkBuffer = [];
		
	this._echoStream = function (options) { // step 2
	  stream.Transform.call(this, options);
	};
	util.inherits(this._echoStream, stream.Transform); // step 1
	this._echoStream.prototype._transform = function (chunk, encoding, done) { // step 3	
		//console.log('received chunk = "'+JSON.stringify(chunk)+'"');
		var clen = chunk.length;
		if (clen === self.frameSize){ //	>5){//		
			self._write(self._commandstr.acknowledge);			
			this.push(self.decodeFrame(chunk));
			self.frame.count++;
			console.error('f_ok: ' + self.frame.count);
		} else if (clen === 1025) {
			var frame = [];
			for (var n = 0; n < 1024; n++){
				frame.push(chunk[n]-40);
			}
			this.push(frame);
			console.error('equilibration frame received');
		} else if (clen >= 2 && clen <= 4 && chunk[0] <= 40){
			self.emit('state', chunk[0]);
		} else if (clen > 10) {
			self._write(self._commandstr.badFrame);
			console.error("Bad frame: " + clen.toString() + ' bytes. last: "' + chunk[chunk.length-self.endBytes] + '"' + "Frame size: "+self.frameSize);
			self.frame.count++;			
			console.error('Bad buffer content: ');
			for (var k = 0; k <clen; k++) {
				console.error('k: ' + k.toString() + ' - ' +  chunk[k].toString() + ', ');
			} 
			console.error('f_no: ' + self.frame.count);
		}		
		done();
	};
	this.dataStream = new this._echoStream({'decodeStrings' : false, 'objectMode' : true}); // instanciate your brand new stream
	//process.stdin.setEncoding('utf8');
	process.stdin.pipe(this.dataStream); //pipe data from standard input
	
	this.on('state',function(state){
		switch(state) {
		case 35:
			self.emit('idle');
			break;
		case 36:
			self._write(self._commandstr.acknowledge);
			self.emit('acquiring');
			break;
		case 33:
			console.log("node ending");
			process.exit();
			break;
		default:
			console.log('other: ' + state.toString());
		}
	});
	this.start = function (){
		self.frame.array = new Array(self.dimension);
		self.frame.rows = self.rows;
		self.frame.columns = self.columns;
		self.frame.raw = self.configData.value.saveRaw;
		self.chunkBuffer = new Buffer(self.dimension + 1);
		self._write(self._commandstr.start);
		self.frame.count = 0;
		console.error('start');
	};

	this.stop = function (cb){
		self._write(self._commandstr.stop);
		console.error('stop');
		function stop(){
			//ask Arduino to stop sending data
			self._write(self._commandstr.stop);
		}	
		var stoper = setInterval(stop, 250);
		self.once('idle', function(){
			clearInterval(stoper);
			if (typeof cb === 'function'){
				cb();
			}
		});
	};
		
	this.decodeFrame = function (chunk){
		var dato,
			index,
			row = 0, 
			col = 0,
			quadrant,
			halfcols = self.columns/2,
		    halfrows = self.rows/2,
		    suma = [0, 0, 0, 0],
			activePixels = [0, 0, 0, 0];
		self.chunkBuffer[self.dimension] = chunk[chunk.length - self.endBytes];//dt
		self.frame.dt = self.chunkBuffer[self.dimension];	
		self.frame.mean = 0;
		self.frame.load = 0;
		self.frame.activePixels = 0;
		
		for (index = 0; index < self.dimension; index++){
			if (col < halfcols && row < halfrows){
				quadrant = 0;
			} else if (col >= halfcols && row < halfrows){
				quadrant = 1;
			} else if (col < halfcols && row >= halfrows){
				quadrant = 2;
			} else {
				quadrant = 3;
			}
			dato = chunk[index] - 40;
			self.chunkBuffer[index] = dato;			
			if (self.configData.value.saveRaw == 0){
				self.frame.array[index] = self.calibratedOutput(dato);//*4
			} else {
				self.frame.array[index] = dato;
			}		
			dato = self.frame.array[index] - self.configData.value.maxZeroFrame[index];
			if (dato > 0){
				if (dato < 255){
					self.chunkBuffer[index] = dato;
				} else {
					self.chunkBuffer[index] = 255;
				}					
				self.frame.mean += dato;
				self.frame.activePixels++;
				suma[quadrant] += dato;  
	        	activePixels[quadrant]++;
			} else {
				self.chunkBuffer[index] = 0;
			}
			col++;
			if (col >= self.columns){
				col = 0;
				row++;
				if (row >= self.rows){
					row = 0;
				}
			}
		}
		for (quadrant = 0; quadrant < 4; quadrant++){
			if (activePixels[quadrant] === 0) {
				self.frame.quadMean[quadrant] = 0;
			} else {
				suma[quadrant] /= (activePixels[quadrant]);//(halfrows*halfcols);
			    self.frame.quadMean[quadrant] = (suma[quadrant]- self.calibrationOffset) * Math.sqrt(activePixels[quadrant]) * self.calibrationFactor;
			    self.frame.quadMean[quadrant] = Math.round(self.frame.quadMean[quadrant]);
			}					    
		}		
	    
		if (self.frame.activePixels === 0){
			self.frame.mean = 0;
		} else {
			self.frame.mean /= self.frame.activePixels;
			self.frame.load = (self.frame.mean - self.calibrationOffset) * Math.sqrt(self.frame.activePixels) * self.calibrationFactor;
			if (self.frame.load < 0) {self.frame.load = 0;}
		}
		self.frame.mean = Math.round(self.frame.mean);
		self.frame.load = Math.round(self.frame.load);
		return self.chunkBuffer;
	};
	
	this.calibratedOutput = function (data){
		var pressure = (self.p2 - self.q1*data) / (data - self.p1);
		if (pressure < 0){
			pressure = 0;
		}
		return Math.round(pressure);
	};
	
	this.equilibrateSensors = function (x0, y0, xn, yn){		
		//ask arduino to start an equilibration
		if (xn > self.columns || yn > self.columns){
			console.error('invalid equilibration area');
			return false;
		}
		console.error('equilibrating sensors from:' + x0 + ',' + y0 + 'to ' + xn + ',' + yn);
		self._write(self._configstr.eqX0 + self.configData.value.x0);
		self._write(self._configstr.eqXn + self.configData.value.xn);
		self._write(self._configstr.eqY0 + self.configData.value.y0);
		self._write(self._configstr.eqYn + self.configData.value.yn);
		self._write(self._commandstr.equilibrate);
	};
	
	this.getEquilibration = function (configFileName) {
		self._write(self._commandstr.getEquilibration);
		self.dataStream.once('data', function(frame) {
			console.error('writing config data: ' + frame);
			self.writeConfigData({"equilibrationFrame": frame}, configFileName);
		});
	};
	
	this.setEquilibration = function (configFileName) {	
		console.error('sending config data ');
		self._write(self._commandstr.setEquilibration);		
	};

};

util.inherits(matController, EventEmitter);

matController.readEquilibration = function (err, eqfile){
	//reads Vs vector from arduino controller and write equilibration file to memory card
};

matController.writeEquilibration = function (err, eqfile){
	//read equilibration file from memory card and write Vs vector to arduino controller
};


module.exports=matController;

