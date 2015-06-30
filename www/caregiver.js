/**
 * 
 */
"use strict";
var patient_name = document.getElementById("patient_name");
var patient_age = document.getElementById("patient_age");
var patient_weight = document.getElementById("patient_weight");
var taskFiles_select = document.getElementById("taskFiles_select");
var taskDetails = document.getElementById("taskDetails");
var canvas_type = document.getElementById("canvas_type");
var main_col = document.getElementById("main_col");
var datails_col = document.getElementById("datails_col");
var graph_div = document.getElementById("graph_div");
var plot_div = document.getElementById('plot_div');
var myCanvas = document.getElementById('myCanvas');
var frames_range = document.getElementById('frames_range');
taskDetails.style.visibility = "hidden";
graph_div.style.visibility = "hidden";

var task = "standStill";
var taskFiles = [];
var taskFiles_items = [];
var readingAllFiles = false;
var fileCounter = 0;
main_col.removeChild(taskFiles_select);
myCanvas.style.visibility = "hidden";
frames_range.style.visibility = "hidden";
var canvasDim;
if (window.innerWidth > window.innerHeight){
	canvasDim = Math.round(window.innerHeight*0.45);
} else {
	canvasDim = Math.round(window.innerWidth*0.45);
}
myCanvas.width = canvasDim;
myCanvas.height = canvasDim;
var matrixCanvas = {};
var results = {
        "summary" : {
            mean: [0, 0, 0],
            std: [0, 0, 0]
        },
        "labels" : {
            label: ["Bilancio destra/sinistra",
                    "Bilancio fronte/retro",
                    "Carico rilevato"],
            unit: ['%', '%', 'kg']
        },
        "measures" : {
            time: [],
            mean: [[], [], []],
            std: [[], [], []]
        },
        "frames": []
	};
var globalResults = {
        "summary" : {
            mean: [0, 0, 0],
            std: [0, 0, 0]
        },
        "labels" : {
            label: ["Bilancio destra/sinistra",
                    "Bilancio fronte/retro",
                    "Carico rilevato"],
            unit: ['%', '%', 'kg']
        },
        "measures" : {
            time: [],
            mean: [[], [], []],
            std: [[], [], []]
        }
	};

/************************ 
 * WebSocket managing 
 * **********************/

var host = window.document.location.host.replace(/:.*/, '');
var ws = new WebSocket('ws://' + host + ':8888'+'/caregiver',  'readFiles');
document.getElementById('msg').innerHTML = 'establishing connection...';
ws.onopen = function (event) {
	document.getElementById('msg').innerHTML = "connected";
	var message = {"action" : {'task': null}};
    ws.send(JSON.stringify(message));
    document.getElementById('msg').innerHTML = "scaricando i dati del paziente...";
};
ws.onmessage = function (event) {
	var bufferData = event.data;
	var data = JSON.parse(bufferData);
	if (data.patientData !== undefined){
		patient_name.innerHTML = data.patientData.name + ' ' + data.patientData.lastname;
		patient_age.innerHTML = data.patientData.age + ' anni';
		patient_weight.innerHTML = data.patientData.weight + ' kg';
		document.getElementById('msg').innerHTML = "Ok";
	} else if (data.files !== undefined){		
		if (main_col.contains(taskFiles_select)){
			var n;
			for (n = 0; n < taskFiles.length; n++){
				taskFiles_select.removeChild(taskFiles_items[n]);
			}
		} else{
			main_col.appendChild(taskFiles_select);
		}
		taskDetails.style.visibility = "hidden";
        graph_div.style.visibility = "hidden";
        canvas_type.style.visibility = "hidden";
        myCanvas.style.visibility = "hidden";
        frames_range.style.visibility = "hidden";
		taskFiles = data.files;
		for (n = 0; n < taskFiles.length; n++){
			taskFiles_items[n] =  document.createElement("OPTION");
			taskFiles_items[n].value = n;
			taskFiles_items[n].innerHTML = taskFiles[n];
			taskFiles_select.appendChild(taskFiles_items[n]);
		}
		taskFiles_select.selectedIndex = 0;
		document.getElementById('msg').innerHTML = "Ok";
	} else if (data.error !== undefined){
		alert(data.error);
		document.getElementById('msg').innerHTML = "Ok";
	} else if (data.frames !== undefined){
        analyzeSingleFile(data);
		if (!readingAllFiles){			
			taskDetails.style.visibility = "visible";
            graph_div.style.visibility = "visible";
            changeCanvas();
			displaySummary(results.summary, results.labels);
			plotMeasures(results.measures, results.labels);
			displayFrames(results.frames);			
		} else{
            globalResults.measures.mean[0][fileCounter] = results.summary.mean[0];
            globalResults.measures.mean[1][fileCounter] = results.summary.mean[1];
            globalResults.measures.mean[2][fileCounter] = results.summary.mean[2];
            globalResults.measures.std[0][fileCounter] = results.summary.std[0];
            globalResults.measures.std[1][fileCounter] = results.summary.std[1];
            globalResults.measures.std[2][fileCounter] = results.summary.std[2];
            var indStart = taskFiles[fileCounter].search('_');
            var indEnd = taskFiles[fileCounter].search('.JSON');
            var time = Number(taskFiles[fileCounter].slice(indStart + 1,indEnd));
            var date = new Date();
            date.setMilliseconds(time);
            globalResults.measures.time[fileCounter] = date;
            fileCounter++;
            if (fileCounter == taskFiles.length){
                globalResults.summary.mean[0] = mean(globalResults.measures.mean[0]);
                globalResults.summary.mean[1] = mean(globalResults.measures.mean[1]);
                globalResults.summary.mean[2] = mean(globalResults.measures.mean[2]);
                globalResults.summary.std[0] = std(globalResults.measures.mean[0]);
                globalResults.summary.std[1] = std(globalResults.measures.mean[1]);
                globalResults.summary.std[2] = std(globalResults.measures.mean[2]);
                globalResults.labels = results.labels;
                taskDetails.style.visibility = "visible";
                graph_div.style.visibility = "visible";
                canvas_type.selectedIndex = 0;
                changeCanvas();
                displaySummary(globalResults.summary, globalResults.labels);
                plotMeasures(globalResults.measures, globalResults.labels);
                readingAllFiles = false;
            } else{
                var message = {"action" : {'task': task, 'file': taskFiles[fileCounter]}};
                ws.send(JSON.stringify(message));
                document.getElementById('msg').innerHTML = 'scaricando i dati del registro ' + (fileCounter + 1).toString + '/' + taskFiles.length.toString() + ' ...';
            }
        }
		document.getElementById('msg').innerHTML = "Ok";
	}		
}	
	
//task selection
var taskSelect=document.getElementById('taskSelect');
taskSelect.addEventListener('input', changeTask); 
function changeTask(){
	task = taskSelect.value;
	var message = {"action" : {'task': task, 'file': null}};
    ws.send(JSON.stringify(message));
	document.getElementById('msg').innerHTML = "scaricando i dati dell'attività...";	
}

//file selection
taskFiles_select.addEventListener('input', changeFile); 
function changeFile(){
	var message;
	if (taskFiles_select.selectedIndex > 1){
		message = {"action" : {'task': task, 'file': taskFiles[taskFiles_select.value]}};
	    ws.send(JSON.stringify(message));
	    document.getElementById('msg').innerHTML = "scaricando i dati del registro...";
        canvas_type.style.visibility = "visible";
	} else if (taskFiles_select.selectedIndex == 1){
        canvas_type.style.visibility = "hidden";
        if (taskFiles.length === 0){ return;}
        message = {"action" : {'task': task, 'file': taskFiles[0]}};
	    ws.send(JSON.stringify(message));
	    document.getElementById('msg').innerHTML = 'scaricando i dati del registro ' + '1/' + taskFiles.length.toString() + ' ...';
        readingAllFiles = true;
        fileCounter = 0;
    }
}

//graph selection
canvas_type.addEventListener('input', changeCanvas); 
function changeCanvas(){
    if (canvas_type.selectedIndex == 0){
        myCanvas.style.visibility = "hidden";
        frames_range.style.visibility = "hidden";
        if (!graph_div.contains(plot_div)){
            graph_div.insertBefore(plot_div, myCanvas);
        }
    } else{
        if (graph_div.contains(plot_div)){
            graph_div.removeChild(plot_div);
        }
        myCanvas.style.visibility = "visible";
        frames_range.style.visibility = "visible";
    }	
}

//displaying task summary data
function displaySummary(summary, labels){
	document.getElementById('value1').innerHTML = summary.mean[0].toFixed(1) + ' +/- ' + summary.std[0].toFixed(1) + ' ' + labels.unit[0];
	document.getElementById('value2').innerHTML = summary.mean[1].toFixed(1) + ' +/- ' + summary.std[1].toFixed(1) + ' ' + labels.unit[1];
	document.getElementById('value3').innerHTML = summary.mean[2].toFixed(1) + ' +/- ' + summary.std[2].toFixed(1) + ' ' + labels.unit[2];
    document.getElementById('measure1').value = labels.label[0];
	document.getElementById('measure2').value = labels.label[1];
	document.getElementById('measure3').value = labels.label[2];
}

//analize task file data
function analyzeSingleFile(dataObj){
	/*var rightLeftArray10x = new Int16Array(dataObj.length);
	var frontBackArray10x = new Int16Array(dataObj.length);
	var loadArray10x = new Int16Array(dataObj.length);
    var msTimeArray = new Uint16Array(dataObj.length);*/
    var rightLeftArray10x = new Array(dataObj.frames.length);
	var frontBackArray10x = new Array(dataObj.frames.length);
	var loadArray10x = new Array(dataObj.frames.length);
    var msTimeArray = new Array(dataObj.frames.length);
    var sumTime = 0;
	var avgRightLeftRatio = 0 , avgFrontBackRatio = 0, avgLoad = 0, duration = 0;
	var length = dataObj.frames.length;
	for (var i = 0; i < length; i++){
		var sum = 0;
		var quadload = dataObj.frames[i].quadMean;
		for (var n = 0; n<4; n++){
			sum += quadload[n];
		}
		rightLeftArray10x[i] = Math.round(1000*(quadload[1] + quadload[3]) / sum);
		frontBackArray10x[i] = Math.round(1000*(quadload[0] + quadload[1]) / sum);
		loadArray10x[i] = Math.round(10*dataObj.frames[i].load);
        sumTime += dataObj.frames[i].dt;
        msTimeArray[i] = sumTime;
		avgRightLeftRatio += 100*(quadload[3] + quadload[3]) / sum;
		avgFrontBackRatio += 100*(quadload[0] + quadload[1]) / sum;
		avgLoad += dataObj.frames[i].load;
	}
	avgRightLeftRatio /= length;
	avgFrontBackRatio /= length;
	avgLoad /= length;
	var stdRightLeftRatio = std(rightLeftArray10x, avgRightLeftRatio*10) / 10;
	var stdFrontBackRatio = std(frontBackArray10x, avgFrontBackRatio*10) / 10;
	var stdLoad = std(loadArray10x, avgLoad*10) / 10;
	var duration = 0;
    results.summary.mean[0] = avgRightLeftRatio;
    results.summary.mean[1] = avgFrontBackRatio;
    var sit2Stand = sitToStandTime(msTimeArray, loadArray10x);
    results.summary.mean[2] = (function(){
                if (task.search('standUp') >= 0){
                    results.measures.start = sit2Stand[1];
                    results.measures.end = sit2Stand[2];
                    return sit2Stand[0]/1000;
                } else{ 
                    results.measures.start = undefined;
                    results.measures.end = undefined;
                    return avgLoad;
                }
            })();
    
    results.summary.std[0] = stdRightLeftRatio;
    results.summary.std[1] = stdFrontBackRatio;
    if (task.search('standUp') >= 0){
        results.summary.std[2] = 0;
        results.labels.label = ["Bilancio destra/sinistra",
                    "Bilancio fronte/retro",
                    "Durata sit-to-stand"];
        results.labels.unit = ['%', '%', 's'];
    } else{
        results.summary.std[2] = stdLoad;
        results.labels.label = ["Bilancio destra/sinistra",
                    "Bilancio fronte/retro",
                    "Carico rilevato"];
        results.labels.unit = ['%', '%', 'kg'];
    }
    results.measures.time = msTimeArray;
    results.measures.mean[0] = rightLeftArray10x;
    results.measures.mean[1] = frontBackArray10x;
    results.measures.mean[2] = loadArray10x;
    results.measures.std = [[], [], []];
    results.frames = dataObj.frames;	
}

//plot measures
function plotMeasures(measures, labels){
    var showPlot = true;
    if (!graph_div.contains(plot_div)){
        graph_div.insertBefore(plot_div, myCanvas);
        showPlot = false;
    }
    var graph1_div = document.getElementById("graph1_div");
    var graph2_div = document.getElementById("graph2_div");
    graph1_div.style.width = Math.round(window.innerWidth*0.45).toString() + 'px';
    graph1_div.style.height = Math.round(window.innerWidth*0.25).toString() + 'px';   
    graph2_div.style.width = Math.round(window.innerWidth*0.45).toString() + 'px';
    graph2_div.style.height = Math.round(window.innerWidth*0.25).toString() + 'px';
    var x;
    var graphData = [];
    for (x in measures.time){
        if (readingAllFiles){
            graphData.push([measures.time[x], [measures.mean[0][x], measures.std[0][x]], [measures.mean[1][x], measures.std[1][x]]]);
        } else{
            graphData.push([measures.time[x]/1000, measures.mean[0][x]/10, measures.mean[1][x]/10]);
        }
    }
    var g1;
    if (readingAllFiles){
       g1 = new Dygraph(graph1_div, graphData, {labels: ["tempo", labels.label[0], labels.label[1]], xlabel: "Tempo/Data", ylabel: "(%)", title: "Bilancio", xRangePad: window.innerWidth*0.01, errorBars: true}); 
    } else{
	   g1 = new Dygraph(graph1_div, graphData, {labels: ["tempo", labels.label[0], labels.label[1]], xlabel: "Tempo (s)", ylabel: "(%)", title: "Bilancio", xRangePad: window.innerWidth*0.01 });
    }
    graphData = [];
    for (x in measures.time){
        if (readingAllFiles){
            graphData.push([measures.time[x], [measures.mean[2][x], measures.std[2][x]]]);
        } else{
            graphData.push([measures.time[x]/1000, measures.mean[2][x]/10]);
        }
    }
    var g2;
    if (readingAllFiles){
        if (task.search('standUp') >= 0){
            g2 = new Dygraph(graph2_div, graphData, {labels: [ "tempo", labels.label[2] ], xlabel: "Tempo/Data", ylabel: "(s)", title: "Durata sit-to-stand", xRangePad: window.innerWidth*0.01, errorBars: true}); 
        } else{
            g2 = new Dygraph(graph2_div, graphData, {labels: [ "tempo", labels.label[2] ], xlabel: "Tempo/Data", ylabel: "(kg)", title: "Carico", xRangePad: window.innerWidth*0.01, errorBars: true}); 
        }
    } else {
        if (task.search('standUp') >= 0){
            g2 = new Dygraph(graph2_div, graphData, {labels: [ "tempo", labels.label[2] ], xlabel: "Tempo (s)", ylabel: "(kg)", title: "Carico", xRangePad: window.innerWidth*0.01});
            if (measures.start !== undefined){
                g2.ready(function() {
                    g2.setAnnotations([{
                        series: labels.label[2],
                        x: measures.time[measures.start],
                        shortText: "S",
                        text: "Start"
                    },{                       
                        series: labels.label[2],
                        x: measures.time[measures.end],
                        shortText: "E",
                        text: "End"
                    }]);       
                });
            }
        }
        else{
	       g2 = new Dygraph(graph2_div, graphData, {labels: [ "tempo", labels.label[2] ], xlabel: "Tempo (s)", ylabel: "(kg)", title: "Carico", xRangePad: window.innerWidth*0.01});
        }
    }
    
    if (!showPlot){
        graph_div.removeChild(plot_div);
    }
}

//display frames
function displayFrames(frames){
    var frameDim = Math.floor(Math.sqrt(frames[0].array.length));
	matrixCanvas = new MatrixCanvas(frameDim, frameDim);
    matrixCanvas.data = frames[0].array;
    matrixCanvas.dt = frames[0].dt;
    matrixCanvas.draw();
    frames_range.value = 0;
}

//frame selection
frames_range.addEventListener('input', changeFrame); 
var frameIndex = 0;
function changeFrame(){
    frameIndex = Math.round((results.frames.length-1)*frames_range.value/100);
    matrixCanvas.data = results.frames[frameIndex].array;
    matrixCanvas.dt = results.frames[frameIndex].dt;
    matrixCanvas.draw();
}

//generic data processing functions
function mean(array){
	var sum = 0;	
	for (var n = 0; n < array.length; n++){
		sum += array[n];
	}
	sum /= array.length;
	return sum;
}

function std(array, average){
	var avg;
	if (mean !== undefined){
		avg = mean(array);
	} else{
		avg = average;
	}
	var sum = 0;
	for (var n = 0; n < array.length; n++){
		sum += (array[n] - avg)*(array[n] - avg);
	}
	return Math.sqrt(sum/array.length);
}

function find(array, comparator, value, type){
    var n;
    var k = 0;
    var outputTypes = {
        "first": 0,
        "last": 1,
        "all": -1
    };
    var index = [0];    
    for (n = 0; n < array.length; n++){
        var expression = array[n].toString() + comparator + value.toString();
        if (eval(expression)){            
            if (outputTypes[type] === outputTypes.first){ 
                return n;
            } else{
                index[k] = n;
                k++;
            }
        }
    }
    if (outputTypes[type] === outputTypes.last){
        return index[k-1];
    } else{
        return index;
    }
}

// Calculation of the sit to stand time
function sitToStandTime(timeArray, loadArray){
    var minIndex = find(timeArray, '>=', 500, 'first');
    var myArray = loadArray.slice(0, minIndex);
    var meanSit = mean(myArray);
    var stdSit = std(myArray, meanSit);
    var maxIndex = find(timeArray, '>=', timeArray[timeArray.length - 1] - 500, 'first');
    var myArray = loadArray.slice(maxIndex);
    var meanStand = mean(myArray);
    var stdStand= std(myArray, meanStand);
    var iStart = find(loadArray, '>', meanSit + stdSit*3, 'first');    
    var stdMovilWindow = 0;
    var n;
    for (n = minIndex; n < maxIndex; n++){
        stdMovilWindow = std(loadArray.slice(n, n + maxIndex - timeArray.length));
        if (stdMovilWindow <= stdStand*1.1 && loadArray[n] > meanStand*0.9){
            break;
        }
    }
    var iEnd = n;
    var duration = timeArray[iEnd] - timeArray[iStart];
    return [duration, iStart, iEnd];
}

//Canvas definition
var MatrixCanvas = function (rows, columns){
	this.data = new Uint16Array(rows*columns);
	this.data.dt = 0;
	var canvas = document.getElementById('myCanvas');
	var context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);
	var dim = Math.round(canvas.width*0.028)*32/rows;//******** modify
	var fontDim = dim/4;
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
		  //console.log("array[1]:  "+array[0].toString());
		  //console.log("array[n]:  "+array[dataSpecs.dimension-1].toString());
		  for (var row = 0; row < rows; row++){
		      for (var col = 0; col < columns; col++){
		    	  data2plot =  Math.round(self.data[i]);
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