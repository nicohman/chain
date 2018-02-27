var blessed = require('blesssed'), contrib = require('contrib'), screen = blessed.screen(), grid = new contrib.grid({rows:4, cols:4, screen:screen}), client = require("socket.io-client");
client = client("https://demenses.net:3000");
/*var node1 = grid.set(0,0,1,1,contrib.donut, {
	label:'Demenses',
	radius:8,
	arcwidth:3,

});*/
setInterval(function(){
	client.emit("m_get_info", {
		cid:client.id
	});
	client.once("m_got_info", function(res){
		console.log(res);
	});
}, 10000);
