var express = require('express');
var app = express();
var path = require("path");
var jwt = require("jsonwebtoken");
var bodyParser = require('body-parser');

var config = require("./config.json");
var client = require("socket.io-client");

client = client("http://localhost:3000");
client.on("connect", function() {
    //  Install middleware
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(function(req, res, next) {
        console.log("TIME:" + Date.now() + "\nIP:" + req.ip);
        next();
    });

    //  Install routes
    app.get("/reset/:token", initiateResetPassword);
    app.post("/reset/:token", resetPassword);

    //  Start server
    console.log("Listening on 80");
    app.listen(80);
});


//  PRIVATE FUNCTIONS

var initiateResetPassword = function(req, res) {
    jwt.verify(req.params.token, config.emailSecret, function(err, un) {
        if (err) {
            return res.status(404).send();
        }
        res.sendFile("./reset.html", {
            root: __dirname
        });
    });
};

var resetPassword = function(req, res) {
    console.log("RECIEVED 'RESET_PASSWORD' request");
    jwt.verify(req.params.token, config.emailSecret, function(err, un) {
        if (req.body.pass1 == req.body.pass2 && !err) {
            console.log("Emit: d_change_pass");
            client.emit("d_change_pass", {
                pass1: req.body.pass1,
                cid: client.id,
                pass2: req.body.pass2,
                token: req.params.token
            });
            client.once("d_changed_pass_" + un.email, function(resd) {
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
