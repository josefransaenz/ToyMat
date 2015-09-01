/**
 * Javascript file of support
 */
var timer;
var ti = 0;
var frames=0;

var canvasDim;
if (window.innerWidth > window.innerHeight){
	canvasDim = Math.round(window.innerHeight*0.9);
} else {
	canvasDim = Math.round(window.innerWidth*0.9);
}
var canvasid = document.getElementById('myCanvas');
canvasid.width = canvasDim;
canvasid.height = canvasDim;

/************************ 
 * WebSocket managing 
 * **********************/
var dataSpecs = {};
var ws = {};
var myCanvas = {};
function createWS(protocolIndex){
	var dataProtocol;
	var	createCanvas = {};	
	switch(protocolIndex){
	case 0:
		dataProtocol="fullMatrix";
		createCanvas = function(){
			myCanvas = new MatrixCanvas(dataSpecs.rows, dataSpecs.columns);
			dataSpecs.dimension=dataSpecs.rows*dataSpecs.columns;
			myCSV = new CSV(dataSpecs);
		};
		break;
	case 1:
		dataProtocol="meanOutput";
		createCanvas = function(){
			dataSpecs.dimension=1;
			myCanvas = new LineCanvas();
			myCSV = new CSV(dataSpecs);
		};
		break;
	case 2:
		dataProtocol="meanOutput";
		createCanvas = function(){
			dataSpecs.dimension=1;
			myCanvas = new IndicatorCanvas();
			myCSV = new CSV(dataSpecs);
		};
		break;
	case 3:
		dataProtocol="quadMeanOutput";
		createCanvas = function(){
			dataSpecs.dimension=4;
			myCanvas = new QuadCanvas();
			myCSV = new CSV(dataSpecs);
		};
		break;
	case 4:
		dataProtocol="fullMatrix";
		createCanvas = function(){
			myCanvas = new MatrixValuesCanvas(dataSpecs.rows, dataSpecs.columns);
			dataSpecs.dimension=dataSpecs.rows*dataSpecs.columns;
			myCSV = new CSV(dataSpecs);
		};
		break;
	default:
		dataProtocol = "fullMatrix";	
	}
	var host = window.document.location.host.replace(/:.*/, '');
	ws = new WebSocket('ws://' + host + ':8888'+'/support',  dataProtocol);
	document.getElementById('msg').innerHTML = 'establishing connection...';
	ws.onopen = function (event) {
		document.getElementById('msg').innerHTML = 'connected';
		var message = {"action" : 'getSpecs'};
    	ws.send(JSON.stringify(message));
	};
	ws.onmessage = function (event) {
		var bufferData = event.data;
		var data = JSON.parse(bufferData);
		if (data.length === undefined){//if it's not a data buffer
			if (data.serialNumber !== undefined){
				var x;
				for (x in data) {
				    dataSpecs[x] = parseInt(data[x]);
				}				
				createCanvas(dataSpecs);
			} else if (data.msg !== undefined){
				var msg = data.msg;
				switch(msg) {
				case 'S':
					streaming = false;
					streamButton.innerHTML = "Start";
			        ti=0;
			        frames=0;
					break;
				case 'E':
					alert('Controller error! (data overflow)')
					streaming = false;
					streamButton.innerHTML = "Start";
			        ti=0;
			        frames=0;
					break;
				default: 
					console.log('msg non supported');
				}
			}			
		} else {
			console.log(data.length.toString());
			readData(data);
		}
	};
	ws.onclose = function (event) {
		console.log('closing websocket');
	};
}
createWS(0);

// Protocol selection
var protocolSelect=document.getElementById('protocol');
protocolSelect.addEventListener('input', changeProtocol); 
function changeProtocol(){	
	if (streaming){
		streamManager();
	} else{
		var message = {"action" : 'stop'};
    	ws.send(JSON.stringify(message));
	}
	document.getElementById('msg').innerHTML = 'renewing connection...';
	function resetWS(){
		ws.close();
		createWS(protocolSelect.selectedIndex);
	}
	setTimeout(resetWS,1000);
}

//Data saving
var CSV = function (Specs){
	this.data = Specs.dimension.toString() + ",";
	for (var i = 1; i <= Specs.dimension; i++){
		this.data += i.toString() + ",";
		}
	this.data += "\n";
};

function exportToCsv() {
    window.open('data:text/csv;charset=utf-8,' + escape(myCSV.data));
}
var saveButton = document.getElementById('save_button');
saveButton.addEventListener('click', exportToCsv); 

//Stream managing
var runAnimation = {
    value: false
};
var streaming=false;
function showTime(){
	ti = ti + 1;
    document.getElementById("time").innerHTML = ti;
}
var date = new Date();
var time = date.getTime();
function streamManager() {
	
	if (ws.readyState !== 1){
		return;
	}
	if (!streaming){
		var message = {"action" : 'start'};
    	ws.send(JSON.stringify(message));
		timer = setInterval(showTime, 1000);
		streaming = true;
		streamButton.innerHTML = "Stop";
		time = date.getTime();
		runAnimation.value = true;
		//animate();
	} else{
		clearInterval(timer);
		var message = {"action" : 'stop'};
    	ws.send(JSON.stringify(message));		
	}
}
var streamButton = document.getElementById('stream_button');
streamButton.addEventListener('click', streamManager);
document.getElementById('myCanvas').addEventListener('click', streamManager);
    
//Data reading
function readData(data){
	var rowData;
    
	if (dataSpecs.dimension>4 && data.length === dataSpecs.dimension+1){
		//rowData = data.dt.toString() + ",";
        var maxi = data[0];
        var mini = data[0];
        var avg = 0;
		rowData = data[dataSpecs.dimension].toString() + ",";//dt
		for (var i = 0; i < dataSpecs.dimension; i++){                  
			myCanvas.data[i] = data[i];            
            rowData += data[i].toString() + ",";
            if (maxi<data[i]){ maxi = data[i];}
            if (mini>data[i]){ mini = data[i];}
        }
        /*for (var m = 12; m<18;m++){
            for (var n = 12;n<18;n++){
                avg += data[m*32 + n];
            }
        }*/
        avg /= 36;
        document.getElementById('msg').innerHTML = 'max: ' + maxi.toString() + ', avg: ' + avg.toString();
        //document.getElementById('msg').innerHTML = 'pixels: ' + data.activePixels.toString();
	} else if (dataSpecs.dimension<=4 && data.length === dataSpecs.dimension){			
		rowData = data.dt.toString() + ",";
        
        document.getElementById('msg').innerHTML = 'pixels: ' + data.activePixels.toString();
        
		myCanvas.data = data;
		myCanvas.dt = data.dt;        
        
		for (var i = 0; i < dataSpecs.dimension; i++){				
            rowData += data[i].toString() + ",";
        }      		
    } else{
    	return;
    }
	rowData += "\n";
    myCSV.data += rowData;
	myCanvas.draw();
	frames = frames +1;				
}

var calibratedOutput = function (data){
		var p1 = 268.4;
		var p2 = 3330;
		var q1 = 242.2;
		var pressure = (p2 - q1*data) / (data - p1);
		if (pressure < 0){
			pressure = 0;
		}
		return pressure;
}

//Canvas definition
var MatrixCanvas = function (rows, columns){
	this.data = new Int16Array(rows*columns);
	this.data.dt = 0;
	var canvas = document.getElementById('myCanvas');
	var context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);
	var dim = Math.round(canvas.width*0.028)*32/rows;//******** modify
	var fontDim = dim/3;
	var widths = Math.round(canvas.width*0.012);
	var myRectangle = {
	  x: widths*3,
	  y: widths*3,
	  width: dim,
	  height: dim,
	  borderWidth: 0.01
	};
	context.font = fontDim.toString() +'pt Calibri';
	for (var row = 0; row < rows; row++){
		context.fillText(row.toString(), 0, (row+1)*dim+fontDim);
		//context.fillText(row.toString(), canvas.width, (row+1)*dim+fontDim);
		}
	for (var col = 0; col < columns; col++){
		context.fillText(col.toString(), (col+1)*dim+fontDim, fontDim);
		//context.fillText(col.toString(), (col+1)*dim+fontDim, canvas.height-fontDim);
		}
	var self = this;
	this.draw = function () {
		  var i = 0;
		  var data2plot;
		  for (var row = 0; row < rows; row++){
		      for (var col = columns-1; col >= 0; col--){                  
		    	  data2plot =  self.data[i];
		    	  context.beginPath();
		    	  context.rect(myRectangle.x+dim*col, myRectangle.y+dim*row, myRectangle.width, myRectangle.height);
		          var br = 0,
		              bg = 0,
		              bb = 0;
		          if (data2plot<50){
		              bb=data2plot*5;
		              br = 0;
		              bg = 0;
		          } else if (data2plot<100){
		              bb=250;
		              bg=(data2plot-50)*5;
		              br = 0;
		          } else if (data2plot<150){
		              bg=250;
		              bb=250-(data2plot-100)*5;
		              br = 0;
		          } else if (data2plot<200){
		        	  bb = 0;
		              bg=250;
		              br=(data2plot-150)*5;
		          } else if (data2plot<250){
		        	  bb = 0;
		              bg=250-(data2plot-200)*5;
		              br=250;
		          } else {
		        	  bb = 0;
		        	  bg = 0;
		              br=255;
		          }	              
		          var boxcolor = 'rgb(' + br + ',' + bg + ',' + bb + ')';
				  i++;
				  context.fillStyle = boxcolor;//'rgb(255,0,0)';
				  context.fill();
				  context.lineWidth = myRectangle.borderWidth;
				  context.strokeStyle = 'black';
		          context.stroke();
		      }
		  }
        
	};
};

var QuadCanvas = function(){
	this.data = new Uint16Array(4);
	this.dt = 0;
	var canvas = document.getElementById('myCanvas');
	var context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);
	var dim = Math.round(canvas.width*0.02);//******** modify
	var widths = Math.round(canvas.width*0.012);
	var myCircle = {
	  x: canvas.width / 2,
	  y: canvas.height / 2,
	  radius: dim,
	  borderWidth: 0.01
	};
	context.font = 'normal 8pt Calibri';
	context.beginPath();
	context.rect(0, 0, canvas.width, canvas.height);	
    context.lineWidth = widths;
    context.strokeStyle = 'black';
    context.stroke();
	var bufferX = [];
    var bufferY = [];
    for (var n = 0; n < 5; n++) {
        bufferX.push(canvas.height / 2);
        bufferY.push(canvas.height / 2);
    }
    function bufferMean (buffer){
        var sum = 0;
        for (var n = 0; n < buffer.length; n++){
            sum += buffer[n];
        }
	   return sum/buffer.length;
    }
	this.draw = function () {
		  var i = 0;
		  var X = (this.data[0] + this.data[2]) - (this.data[1] + this.data[3]);
          X *= canvas.width / 2 / 100;
		  if (X < -(canvas.width / 2) + widths*3){
			  X = -(canvas.width / 2) + widths*3;
		  } else if (X > (canvas.width / 2) - widths*3){
			  X = (canvas.width / 2) - widths*3;
		  }
		  var Y = (this.data[2] + this.data[3]) - (this.data[0] + this.data[1]);
          Y *= canvas.width / 2 / 100;
		  if (Y < -(canvas.height / 2) + widths*3){
			  Y = -(canvas.height / 2) + widths*3;
		  } else if (Y > (canvas.height / 2) - widths*3){
			  Y = (canvas.height / 2) - widths*3;
		  }
        bufferX.unshift(X);
        bufferX.pop();
        X = bufferMean(bufferX);
        bufferY.unshift(Y);
        bufferY.pop();
        Y = bufferMean(bufferY);
		  context.clearRect(widths, widths, canvas.width-widths*2, canvas.height-widths*2);
		  context.lineWidth = Math.round(widths/2);
		  context.strokeStyle = 'gray';
		  context.beginPath();
		  context.moveTo(canvas.width/2, 0);
		  context.lineTo(canvas.width/2, canvas.height);
		  context.stroke();
		  context.moveTo(0, canvas.height/2);
		  context.lineTo(canvas.width, canvas.height/2);
		  context.stroke();
		  context.beginPath();
		  context.arc(myCircle.x + X, myCircle.y + Y, myCircle.radius,  	0, 2 * Math.PI, false);
		  context.fillStyle = 'red';//'rgb(255,0,0)';
		  context.fill();
		  context.lineWidth = myCircle.borderWidth;
		  context.strokeStyle = 'black';
          context.stroke();
	};
};


var LineCanvas = function(){
	this.data = new Uint16Array(1);
	this.dt = 0;
	var canvas = document.getElementById('myCanvas');
	var context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);
	var dim = Math.round(canvas.width*0.02);//******** modify
	var widths = Math.round(canvas.width*0.012);	
	context.font = 'normal 8pt Calibri';
	context.beginPath();
	context.rect(0, 0, canvas.width, canvas.height);	
    context.lineWidth = widths;
    context.strokeStyle = 'black';
    context.stroke();
    this.t = widths;
    this.last = widths;
    this.strokeReturn = true;
    this.draw = function () {
    	var y = Math.round((255-this.data[0])/255*canvas.height);
    	if (y>canvas.height-widths*2){
    		y = canvas.height-widths*2;
    	} else if (y<widths*2){
    		y = widths*2;
    	}
    	var t = this.t + Math.round(this.dt/10000*canvas.width);
    	if (this.strokeReturn){
    		this.t = widths;
    		this.last = y;
    	}
    	if (t>canvas.width-widths*2){
    		t = canvas.width-widths;
    		this.strokeReturn = true;
    		context.clearRect(this.t, t - this.t, widths, canvas.height-widths*2);
    	} else{
    		context.clearRect(this.t, widths, widths*2, canvas.height-widths*2);
    	}    	
    	context.lineWidth = Math.round(widths/2);    	
    	context.beginPath();
    	context.moveTo(0, canvas.height/2);
    	context.lineTo(canvas.width, canvas.height/2);
    	context.strokeStyle = 'gray';
    	context.stroke();
    	context.beginPath();
    	context.moveTo(0, canvas.height/4);
    	context.lineTo(canvas.width, canvas.height/4);
    	context.strokeStyle = 'gray';
    	context.stroke();
    	context.beginPath();
    	context.moveTo(0, canvas.height*3/4);
    	context.lineTo(canvas.width, canvas.height*3/4);
    	context.strokeStyle = 'gray';
    	context.stroke();  
    	context.beginPath();
    	context.moveTo(this.t, this.last);
    	context.lineTo(t, y);
    	context.strokeStyle = 'red';
		context.stroke();
		if (this.strokeReturn){
			this.t = widths;
			this.strokeReturn = false;
		} else{
			this.t = t;
		}		
		this.last = y;		
    	
    }
};

Uint16Array.prototype.mean = function (){
	var sum = 0;
	for (var n = 0; n < this.length; n++){
		sum += this[n];
	}
	return sum/this.length;
};

Uint16Array.prototype.std = function (){
	var mean = this.mean();
	var sum;
	for (var n = 0; n < this.length; n++){
		sum += (this[n] - mean)*(this[n] - mean);
	}
	return Math.sqrt(sum/this.length);
};

var IndicatorCanvas = function(){
	this.data = new Int16Array(1);
	this.dt = 0;
	var canvas = document.getElementById('myCanvas');
	var context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);
	var dim = Math.round(canvas.width*0.15);//******** modify
	var widths = Math.round(canvas.width*0.012);
	var myCircle = {
			  x: canvas.width / 2,
			  y: canvas.height / 2,
			  radius: canvas.height / 2 - dim,
			  borderWidth: widths
			};
    
	context.beginPath();
	context.arc(myCircle.x, myCircle.y, myCircle.radius,  	0, 2 * Math.PI, false);
	context.fillStyle = 'white';//'rgb(255,0,0)';
	context.fill();
	context.lineWidth = myCircle.borderWidth;
	context.strokeStyle = 'black';
	context.stroke();
	this.nAverage = 10;
	this.dataBuffer = new Int16Array(this.nAverage);
	this.firstTime = true;
	this.pointer = 0;	
    this.draw = function () {
    	var i;
    	var dato = (this.data[0]);
    	if (this.firstTime){
    		for (i = 0; i < this.nAverage; i++){
    			this.dataBuffer[i] = dato;
    		}
    		this.firstTime = false;
    	} else{
    		this.dataBuffer[this.pointer] = dato; 
    		this.pointer++;
    		if (this.pointer >= this.nAverage){
    			this.pointer = 0;
    		} else{
    			return;
    		}
    	}
    	var dataMean = 0;
    	for (i = 0; i < this.nAverage; i++){
    		dataMean += this.dataBuffer[i];
		}
    	dataMean /= this.nAverage;
    	context.clearRect(0, 0, canvas.width, canvas.height);
    	context.beginPath();
    	context.arc(myCircle.x, myCircle.y, myCircle.radius,  	0, 2 * Math.PI, false);
    	context.fillStyle = 'white';//'rgb(255,0,0)';
    	context.fill();
    	context.lineWidth = myCircle.borderWidth;
    	context.strokeStyle = 'black';
    	context.stroke();
          
    	context.beginPath();
        context.moveTo(myCircle.x, myCircle.y);
        var X = (myCircle.radius - widths*2)*Math.sin((180-dataMean)*Math.PI/180);
        var Y = (myCircle.radius - widths*2)*Math.cos((180-dataMean)*Math.PI/180);
        context.lineTo(myCircle.x-X, myCircle.y-Y);
        context.lineWidth = widths;
        context.strokeStyle = 'red';
        context.stroke();
            
        var textOutput = dataMean.toString()+'kg';
        context.font = dim.toString()+'pt Calibri';
        context.textAlign = 'center';
        context.fillStyle = 'blue';
        context.fillText(textOutput, myCircle.x, myCircle.y+dim);		
    	
    }
};

var MatrixValuesCanvas = function (rows, columns){
	this.data = new Uint16Array(rows*columns);
	this.data.dt = 0;
	var canvas = document.getElementById('myCanvas');
	var context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);	
	var dim = Math.round(canvas.width*0.028)*32/rows;//******** modify
	var widths = Math.round(canvas.width*0.012);
	var myRectangle = {
	  x: widths*3 + dim/2,
	  y: widths*3 + dim/2,
	  width: dim,
	  height: dim,
	  borderWidth: 0.01
	};
	var fontDim = dim/3;
	var indicatorFont = dim/3;
	context.fillStyle = 'red';
	context.font = fontDim.toString()+'pt Calibri';
	for (var row = 0; row < rows; row++){
		context.fillText(row.toString(), 0, (row+1)*dim+fontDim);
		//context.fillText(row.toString(), canvas.width-10, (row+1)*dim+(dim/5));
		}
	for (var col = 0; col < columns; col++){
		context.fillText(col.toString(), (col+1)*dim+fontDim, fontDim);
		//context.fillText(col.toString(), (col+1)*dim+5, canvas.height-6);
		}
	var self = this;
	this.draw = function () {
		var i = 0;
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = 'red';
		context.font = fontDim.toString()+'pt Calibri';
		for (var row = 0; row < rows; row++){
			context.fillText(row.toString(), 0, (row+1)*dim+fontDim);
			//context.fillText(row.toString(), canvas.width-fontDim, (row+1)*dim+fontDim);
			}
		for (var col = 0; col < columns; col++){
			context.fillText(col.toString(), (col+1)*dim+fontDim, fontDim);
			//context.fillText(col.toString(), (col+1)*dim+fontDim, canvas.height-fontDim);
			}
		
	  for (var row = 0; row < rows; row++){
	      for (var col = 0; col < columns; col++){
	    	  var textOutput = (Math.round(self.data[i]/217*100)).toString()+'%';
	    	  i++;
	          context.font = indicatorFont.toString()+'pt Calibri';
	          context.textAlign = 'center';
	          context.fillStyle = 'blue';
	          context.fillText(textOutput, myRectangle.x+dim*col, myRectangle.y+dim*row);
	          
	      }
	  }
	};
};
  

  
