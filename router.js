/**
 * ToyMat router file
 */
function route(handle, pathname, response, request) {
  if (typeof handle[pathname] === 'function') {
	  handle[pathname](response, request);
  } else if (pathname.search(".") >= 0){
	  handle.sendFile(response, pathname);
  } else {
	  console.log("No request handler found for " + pathname);
	  response.writeHead(404, {"Content-Type": "text/html"});  
	  response.write("404 Not found");
	  response.end();
  }
}

exports.route = route;