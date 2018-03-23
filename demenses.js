var express = require('express');
var app = express();
var htt = express();
var fs = require("fs");
var https = require("https");
var Caman = require("caman").Caman;
var path = require("path");
var jwt = require("jsonwebtoken");
var bodyParser = require('body-parser');
var privKey = fs.readFileSync("/etc/letsencrypt/live/demenses.net/privkey.pem",
	"utf8");
var cert = fs.readFileSync("/etc/letsencrypt/live/demenses.net/fullchain.pem",
	"utf8");
var config = require("./config.json");
var client = require("socket.io-client");
var defaultsBig = ["0d3944", "FFFFFF"];
var defaultsSmall = ["#ff6a00", "#4c4c4c"];

function hexToRgb(hex) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}
Caman.Filter.register("convertToC", function (cur, to) {
	var convCur1 = hexToRgb(cur[0]);
	var convCur2 = hexToRgb(cur[1]);
	var convTo1 = hexToRgb(to[0]);
	var convTo2 = hexToRgb(to[1]);
	console.log(convCur1);
	this.process("convertToC", function (rgba) {
		var prev = rgba.a;
		if (rgba.r == convCur1.r && rgba.b == convCur1.b && rgba.g ==
			convCur1.g) {
			rgba.r = convTo1.r;
			rgba.b = convTo1.b;
			rgba.g = convTo1.g;
		} else if (rgba.r == convCur2.r && rgba.b == convCur2.b &&
			rgba.g == convCur2.g) {
			rgba.r = convTo2.r;
			rgba.b = convTo2.b;
			rgba.g = convTo2.g;
		}
		rgba.a = prev;
		return rgba;
	});
});
var initiateResetPassword = function (req, res) {
	jwt.verify(req.params.token, config.emailSecret, function (err) {
		if (err) {
			return res.status(404).send();
		}
		res.sendFile("./reset.html", {
			root: __dirname
		});
	});
};

client = client("https://demenses.net:3000",{secure:true});

client.on("connect", function () {
	//  Install middleware
	app.use(bodyParser.urlencoded({
		extended: true
	}));
	app.use(express.static(path.join("/home/nicohman/chain/public","")));
	app.use(function (req, res, next) {
		console.log("TIME:" + Date.now() + "\nIP:" + req.ip);
		next();
	});
	//  Install routes
	app.get("/reset/:token", initiateResetPassword);
	app.post("/reset/:token", resetPassword);
	//  Start server
	app.get("/logo/big/:color1/:color2", function (req, res) {
		console.log("Logo req");
		fs.access('./public/logos/big/' + req.params.color1 + '-' +
			req.params.color2 + '.png',
			function (err) {
				if (err) {
					console.log(
						"Logo configuration not found, generating");
					Caman(__dirname + "/public/basic_big.png",
						function () {
							this.convertToC(defaultsBig, [req.params
								.color1,
								req.params.color2
							]);
							this.render(function () {
								this.save(__dirname +
									"/public/logos/big/" +
									req.params.color1 + "-" +
									req.params.color2 +
									".png");
								setTimeout(function () {
									res.sendFile(
										"./public/logos/big/" +
										req.params.color1 +
										"-" + req.params
										.color2 + ".png", {
											root: __dirname
										});
								}, 20)
							});
						});
				} else {
					res.sendFile("./public/logos/big/" + req.params.color1 +
						"-" + req.params.color2 + ".png", {
							root: __dirname
						});
				}
			});
	});
	app.get("/logo/small/:color1/:color2", function (req, res) {
		console.log("Logo req small");
		fs.access('./public/logos/small/' + req.params.color1 + '-' +
			req.params.color2 + '.png',
			function (err) {
				if (err) {
					console.log(
						"Logo configuration not found, generating");
					Caman(__dirname + "/public/basic_small.png",
						function () {
							this.convertToC(defaultsSmall, [req.params
								.color1,
								req.params.color2
							]);
							this.render(function () {
								this.save(__dirname +
									"/public/logos/small/" +
									req.params.color1 + "-" +
									req.params.color2 +
									".png");
								setTimeout(function () {
									res.sendFile(
										"./public/logos/small/" +
										req.params.color1 +
										"-" + req.params
										.color2 + ".png", {
											root: __dirname
										});
								}, 20)
							});
						});
				} else {
					res.sendFile("./public/logos/small/" + req.params
						.color1 + "-" + req.params.color2 + ".png", {
							root: __dirname
						});
				}
			});
	});
	console.log("Listening on 80");
	var serv = https.createServer({
		key: privKey,
		cert: cert
	}, app);
	app.use(function (req, res, next) {
		res.status(404);
		res.sendFile("./public/404.html");
	})
	serv.listen(443);
	htt.all("*", function (req, res) {
		return res.redirect("https://" + req.headers['host'] + req.url);
	});
	htt.listen(80);
	//app.listen(80);

})
//  PRIVATE FUNCTIONS
var resetPassword = function (req, res) {
	console.log("RECIEVED 'RESET_PASSWORD' request");
	jwt.verify(req.params.token, config.emailSecret, function (err, un) {
		if (req.body.pass1 == req.body.pass2 && !err) {
			console.log("Emit: d_change_pass");
			client.emit("d_change_pass", {
				pass1: req.body.pass1,
				cid: client.id,
				pass2: req.body.pass2,
				token: req.params.token
			});
			client.once("d_changed_pass_" + un.email, function (resd) {
				if (resd) {
					res.redirect("/changed.html");
				}
			});
		} else {
			//  Access denied!!
			res.status(401).send();
		}
	});
};
