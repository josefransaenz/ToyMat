/**
 * 
 */
"use strict";
var message = document.getElementById("message");
var image = document.getElementById("image");
var main_jumbotron = document.getElementById("main_jumbotron");
var main_col = document.getElementById("main_col");
var image_col = document.getElementById("image_col");
var msg_comment = document.getElementById("msg_comment");
var start_button = document.getElementById("start_button");
var cancel_button = document.getElementById("cancel_button");
var progress_bar = document.getElementById("progress_bar");
var load_bar = document.getElementById("load_bar");
var sequence = document.getElementById("sequence");

var canvasDim;
if (window.innerWidth > window.innerHeight){
	canvasDim = Math.round(window.innerHeight/2);
} else {
	canvasDim = Math.round(window.innerWidth/2);
}
var canvasid = document.getElementById('myCanvas');
canvasid.width = canvasDim;
canvasid.height = canvasDim;


main_jumbotron.removeChild(start_button);
main_col.removeChild(cancel_button);
start_button.addEventListener("click", nextTask);
cancel_button.addEventListener("click", cancelTask);
var command;
var myCanvas;
var host = window.document.location.host.replace(/:.*/, '');
var ws = new WebSocket('ws://' + host + ':8888'+'/fitTest0',  'fitTest0');
ws.onopen = function (event) {
	main_jumbotron.appendChild(start_button);	
	myCanvas = new QuadCanvas();
    command = {"action" : 'start'};
	ws.send(JSON.stringify(command));
    command = {"action" : {sequence: sequence.value}};
	ws.send(JSON.stringify(command));
};
ws.onmessage = function (event) {
	var bufferData = event.data;
	var data = JSON.parse(bufferData);
	if (data.message !== undefined){
		message.innerHTML = data.message;
	}
	if (data.comment !== undefined){
		msg_comment.innerHTML = data.comment;
	} 
	if (data.nextImage !== undefined){
		image.src = data.nextImage;
	} else{
		//image.src = null;
	}
	if (data.nextButtonEnable){
		main_jumbotron.appendChild(start_button);
	} else{
		if (main_jumbotron.contains(start_button)){        
	        main_jumbotron.removeChild(start_button);    
	    }
	}
	if (data.progress !== undefined){
		if (data.progress !== null){
			progress_bar.innerHTML = data.progress.toString() + '%';
			progress_bar.style.width = data.progress.toString() + '%';
			if (data.quadMean !== undefined){
				myCanvas.data = data.quadMean;
				myCanvas.draw();
			}
		} else {
			progress_bar.innerHTML = "";
			progress_bar.style.width = "0%";
			var canvas = document.getElementById('myCanvas');
			var context = canvas.getContext('2d');
			context.clearRect(0, 0, canvas.width, canvas.height);
		}		
	}
	if (data.load !== undefined){
		if (data.load !== null){
			var fill = (Math.round(parseInt(data.load)/150*100)).toString() + '%';
			load_bar.innerHTML = data.load.toString() + 'kg';
			load_bar.style.width = fill;
		} else {
			load_bar.innerHTML = "";
			load_bar.style.width = "0%";
		}		
	}
};
ws.onclose = function (event) {
	console.log('closing websocket');
};

function nextTask(){
    if (!main_col.contains(cancel_button)){
        main_col.appendChild(cancel_button);
    }
	image.src = "/images/loading.gif";
	message.innerHTML = "Caricando...";
	msg_comment.innerHTML = "aspetti un momento.";
	command = {"action" : 'nextStep'};
	ws.send(JSON.stringify(command));
}

function cancelTask(){
	image.src = "/images/toymat1.png";
	message.innerHTML = "Anullando...";
	msg_comment.innerHTML = "aspetti un momento.";
	command = {"action" : 'stop'};
	ws.send(JSON.stringify(command));
}

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
	
	
	this.draw = function () {
		context.font = 'normal 8pt Calibri';
		context.beginPath();
		context.rect(0, 0, canvas.width, canvas.height);	
	    context.lineWidth = widths;
	    context.strokeStyle = 'black';
	    context.stroke();
		  var i = 0;
		  var X = (this.data[0] + this.data[2]) - (this.data[1] + this.data[3]);
		  if (X < -(canvas.width / 2) + widths*3){
			  X = -(canvas.width / 2) + widths*3;
		  } else if (X > (canvas.width / 2) - widths*3){
			  X = (canvas.width / 2) - widths*3;
		  }
		  var Y = (this.data[0] + this.data[1]) - (this.data[2] + this.data[3]);
		  if (Y < -(canvas.height / 2) + widths*3){
			  Y = -(canvas.height / 2) + widths*3;
		  } else if (Y > (canvas.height / 2) - widths*3){
			  Y = (canvas.height / 2) - widths*3;
		  }
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
