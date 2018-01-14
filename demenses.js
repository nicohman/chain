var express = require('express');
var app = express();
var path = require("path");
var jwt = require("jsonwebtoken");
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
	extended: true
}));
var config = require("./config.json");
var client = require("socket.io-client");
client = client("http://localhost:3000");
client.on("connect", function() {
	app.use(function(req, res, next) {
		console.log("TIME:" + Date.now() + "\nIP:" + req.ip);
		next();
	});
	app.get("/reset/:token", function(req, res) {
		jwt.verify(req.params.token, config.emailSecret, function(err, un) {
			if (err) {
				res.send("Not a valid reset url");
			} else {
				res.sendFile("./reset.html", {root:__dirname});
			}
		});
	});
	app.post("/reset/:token", function(req, res) {
		console.log("RECIEVED POST");
		jwt.verify(req.params.token, config.emailSecret, function(err, un) {
			console.log(req.body);
			console.log(err);
			console.log(un);
			if (req.body.pass1 == req.body.pass2 && err === null) {
				console.log("emitted");
				client.emit("d_change_pass", {
					pass1: req.body.pass1,
					cid:client.id,
					pass2: req.body.pass2,
					token: req.params.token
				});
				client.once("d_changed_pass_" + un.email, function(resd) {
					if (resd) {
						res.redirect("/changed.html");
					}
				});
			}
		});

	});
	app.use(express.static(path.join(__dirname, 'public')));
	console.log("Listening on 3953");
	app.listen(3953);
});
