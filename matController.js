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
		rows : '32', //two chars from 01 to 32
		columns : '32', //two chars from 01 to 32
		eqThreshold : '247', // desired digital output
							 // better if it's equal to pressure in kPa, 
							 // must have three chars from 000 to 999		
		pgaGain : '1', //gain parameter for PGA, single char '1' means gain x2 (see PGA datasheet)
		endBytes : '2', //number of bytes at the end of each frame, 2 = dt + newLine char
		p1: '644',
		p2: '2465',
		q1: '80',
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
    	this.rows = parseInt(this.configData.value.rows);
    	this.columns = parseInt(this.configData.value.columns);
    	this.endBytes = parseInt(this.configData.value.endBytes);
    	this.dimension = this.rows*this.columns;
    	if (this.dimension > 256){
    		this.bytes = 1;
    	} else{
    		this.bytes = 2;
    	}
    	this.frameSize = this.dimension*this.bytes+this.endBytes;
    	this.calibrationOffset = parseInt(this.configData.value.calibrationOffset);
    	this.calibrationFactor = parseInt(this.configData.value.calibrationWeight)/parseInt(this.configData.value.calibrationOutput);
    	this.p1 = parseInt(this.configData.value.p1);
		this.p2 = parseInt(this.configData.value.p2);
		this.q1 = parseInt(this.configData.value.q1);
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
		self._write(self._configstr.rows + self.configData.value.rows);
		self._write(self._configstr.columns + self.configData.value.columns);
		self._write(self._configstr.eqThreshold + self.configData.value.eqThreshold);
		//self._write(self._configstr.bytes + self.configData.value.bytes);
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
			dt: 0,
			mean: 0,
			load: 0,
			count: 0,
			quadMean: new Array(4),
			activePixels: 0
	};
		
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
		self.frame.array = new Array(self.dimension);
		var dim = self.dimension;
		var i;
		var endBytes = self.endBytes;
		var chunk2 = new Buffer(dim+1);
		chunk2[dim] = chunk[chunk.length-endBytes];//dt
		self.frame.dt=chunk[chunk.length-endBytes];	
		self.frame.mean = 0;
		self.frame.load = 0;
		self.frame.activePixels = 0;
		var dato;
		if (self.bytes === 1){	
			for (i = 0; i < dim; i++){
				dato = chunk[i] - 40;	
				self.frame.array[i] = self.calibratedOutput(dato);//*4
				dato = self.frame.array[i] - self.configData.value.maxZeroFrame[i];
				if (dato > 0){
					if (dato < 255){
						chunk2[i] = dato;
					} else {
						chunk2[i] = 255;
					}					
					self.frame.mean += dato;
					self.frame.activePixels++;
				} else {
					chunk2[i] = 0;
				}				
	        }
			//console.error('load: ' + self.frame.load.toString() + ' + ' + self.frame.activePixels.toString())			
		} else if (self.bytes === 2){
			var n=0;
			for (i = 0; i < chunk.length-endBytes; i = i + 2){
				//chunk2[n] = (chunk[i+1] - 40) + (chunk[i] - 40);				
				self.frame.array[n] = (chunk[i] - 40);
				//self.frame.array[n] *= 4;
				self.frame.array[n] += chunk[i+1]-40;
				self.frame.array[n] = self.calibratedOutput(self.frame.array[n]);
				//self.frame.mean += self.frame.array[n];
				if (self.frame.array[i] > self.configData.value.maxZeroFrame[i]){
					
					if (self.frame.array[i] < 255){
						chunk2[n] = self.frame.array[n];
					} else {
						chunk2[n] = 255;
					}					
					self.frame.mean += self.frame.array[n];
					self.frame.activePixels++;
				} else {
					chunk2[n] = 0;
				}				
				n++;
			}
		}		
		var quad = dataProcessing.quadMean(self.frame.array, self.configData.value.maxZeroFrame);
		for (var j = 0; j < 4; j++){          
			self.frame.quadMean[j] = (quad[j]- self.calibrationOffset) * Math.sqrt(self.frame.activePixels) * self.calibrationFactor;
		}
		if (self.frame.activePixels === 0){
			self.frame.mean = 0;
		} else {
			self.frame.mean /= self.frame.activePixels;
			self.frame.load = (self.frame.mean - self.calibrationOffset) * Math.sqrt(self.frame.activePixels) * self.calibrationFactor;
			if (self.frame.load < 0) {self.frame.load = 0;}
		}		
		return chunk2;
	};
	
	this.calibratedOutput = function (data){
		var pressure = (self.p2 - self.q1*data) / (data - self.p1);
		if (pressure < 0){
			pressure = 0;
		}
		return pressure;
	};
	
	this.equilibrateSensors = function (x0, y0, xn, yn){		
		//ask arduino to start an equilibration
		if (xn>self.columns || yn>self.columns){
			console.error('invalid equilibration area');
			return false;
		}
		console.error('equilibrating sensors from:' + x0 + ',' + y0 + 'to ' + xn + ',' + yn);
		self._write(self._configstr.eqX0 + x0);
		self._write(self._configstr.eqXn + xn);
		self._write(self._configstr.eqY0 + y0);
		self._write(self._configstr.eqYn + yn);
		self._write(self._commandstr.equilibrate);
	};
	
	this.getEquilibration = function (configFileName) {
		self._write(self._commandstr.getEquilibration);
		self.dataStream.once('data', function(frame) {
			console.error('writing config data: ' + frame);
			self.writeConfigData({"equilibrationFrame": frame}, configFileName);
		});
	}
	
	this.setEquilibration = function (configFileName) {	
		console.error('sending config data ');
		self._write(self._commandstr.setEquilibration);		
	}

};

util.inherits(matController, EventEmitter);

matController.readEquilibration = function (err, eqfile){
	//reads Vs vector from arduino controller and write equilibration file to memory card
};

matController.writeEquilibration = function (err, eqfile){
	//read equilibration file from memory card and write Vs vector to arduino controller
};


module.exports=matController;

