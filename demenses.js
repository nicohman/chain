var express = require('express');
var app = express();

app.use(express.static('public'));
console.log("Listening on 3953");
app.listen(3953);

