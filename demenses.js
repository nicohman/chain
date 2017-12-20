var express = require('express');
var app = express();
app.use(function(req, res, next){
	console.log("TIME:"+Date.now()+"\nIP:"+req.ip);
	next();
});
app.use(express.static('public'));
console.log("Listening on 3953");
app.listen(3953);

