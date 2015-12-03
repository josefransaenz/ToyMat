/**
 * New node file
 */
//"use strict";
function initArray(array, initValue){
	if (initValue === undefined){
		initValue = 0;
	}
	for (var n = 0; n < array.length; n++){
		array[n] = initValue;
	}
	return array;
}

function shiftLeft(array, inputValue){
	if (inputValue === undefined){
		inputValue = 0;
	}
	for (var n = 1; n < array.length; n++){
		array[n-1] = array[n];
	}
	array[array.length-1] = inputValue;
	return array;
}

function max(array){
	var maxi = array[0];	
	for (var n = 0; n < array.length; n++){
		if (maxi < array[n]){
			maxi = array[n];
		}
	}
	return maxi;
}

function mean(array){
	var sum = new array.constructor(1);
	sum = 0;	
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


function quadMean(frame, refFrame){	
	var suma = new frame.constructor(4);
	var activePixels = [0, 0, 0, 0];
	var length = frame.length;
	if (refFrame === undefined){
		refFrame = new Array(length);
		refFrame = initArray(refFrame);
	}
	var rows;
	var columns;
	if (frame.rows !== undefined) {
		rows = frame.rows;
		columns = frame.columns;
	} else {
		rows = Math.floor(Math.sqrt(length));
		columns = rows;
	}	
	var halfcols = columns/2;
    var halfrows = rows/2;
    var j = 0;
    var i = 0;
    var index = 0;
    suma = initArray(suma);
    for (j = 0; j < halfrows; j++){
      for(i = 0; i< halfcols; i++){
        index = j*columns + i;
        if (frame[index] > refFrame[index]){
        	suma[0] += frame[index];  
        	activePixels[0]++;
        }
      }
    }
    for (j = 0; j<halfrows; j++){
      for(i = halfcols; i < columns; i++){
    	index = j*columns + i;
    	if (frame[index] > refFrame[index]){
        	suma[1] += frame[index];  
        	activePixels[1]++;
        }
      }
    }
    for (j = halfrows; j < rows; j++){
      for(i = 0; i < halfcols; i++){
    	index = j*columns + i;
    	if (frame[index] > refFrame[index]){
        	suma[2] += frame[index];  
        	activePixels[2]++;
        }
      }
    }
    for (j = halfrows; j< rows; j++){
      for(i = halfcols; i < columns; i++){
    	index = j*columns + i;
    	if (frame[index] > refFrame[index]){
        	suma[3] += frame[index];  
        	activePixels[3]++;
        }
      }
    }
    
    for (j = 0; j < 4; j++){          
      suma[j] /= activePixels[j];//(halfrows*halfcols);
      suma[j] = Math.round(suma[j]);
    }
	return suma;
}

exports.initArray = initArray;
exports.shiftLeft = shiftLeft;
exports.max = max;
exports.mean = mean;
exports.std = std;
exports.quadMean = quadMean;