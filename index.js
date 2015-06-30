/**
 * Index file of ToyMat3 
 */
var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");
var socketServer = require("./socketServer");
var dataHandlers = require("./dataHandlers");

var handle = {};
handle["/"] = requestHandlers.patient;
handle["/patient"] = requestHandlers.patient;
handle["/support"] = requestHandlers.support;
handle["/equilibrate"] = requestHandlers.equilibrate;
handle["/calibrate"] = requestHandlers.calibrate;
handle["/streamdata"] = requestHandlers.streamdata;
handle["/caregiver"] = requestHandlers.caregiver;
handle.sendFile = requestHandlers.sendFile;

var socketHandle = {};
socketHandle["startController"] = dataHandlers.startController;
socketHandle["stopController"] = dataHandlers.stopController;
socketHandle["fitTest0"] = dataHandlers.fitTest0;
socketHandle["fullMatrix"] = dataHandlers.realTimeStreaming;
socketHandle["meanOutput"] = dataHandlers.realTimeStreaming;
socketHandle["quadMeanOutput"] = dataHandlers.realTimeStreaming;
socketHandle["readFiles"] = dataHandlers.readFiles;

socketServer.start(server.start(router.route, handle), socketHandle);

