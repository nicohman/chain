var blessed = require('blessed'), contrib = require('blessed-contrib'), screen = blessed.screen(), grid = new contrib.grid({rows:4, cols:5, screen:screen}), client = require("socket.io-client");
client = client("https://demenses.net:3000");
var names = ["Dragon", "Defiant", "The Dragon's Teeth"];
var colors = ["green", "yellow", "blue"];
var nodeDonuts = [];
console.log("HI");
var all = grid.set(0,3,2,2,contrib.donut, {
	label:'All Nodes',
	radius:30,
	arcwidth:20,
	remainColor:'black',
	yPadding:2
});
var users = grid.set(1, 0, 3, 3, contrib.line, {
	style:{
		line:"green",
		text:"blue"
	},
	height:20,
	xLabelPadding:3,
	showLegend:true,
	wholeNumbersOnly:true,
	label:"Users"
	}
);
var tU = {
	title:"User Accounts",
	x:[],
	y:[]
}
var aU = {
	style:{
		line:"red"
	},
	title:"Active Users",
	x:[],
	y:[],
}
names.forEach(function(val, ind){
nodeDonuts[ind] = grid.set(0,ind,1,1,contrib.donut, {
	label:'Node Status',
	radius:8,
	arcwidth:3,
	remainColor:'black',
	yPadding:2
});
});
function reducer (x, y) {
	return x+y;
}
function update(){
	client.emit("m_get_info", {
		cid:client.id
	});
	client.once("m_got_info", function(res){
		console.log(res);
		var total = res.active.filter(function(x){
			return x;
		}).length;
		var tact = res.users.reduce(reducer);
		all.setData([{
			percent:total* (100/3),
			label:"Total",
			color:"green"
		}]);
		nodeDonuts.forEach(function(val, ind){
			var per = 100;
			if(!res.active[ind]){
				per = 0;
			}
			nodeDonuts[ind].setData([{
				label:names[ind],
				color:colors[ind],
				percent:per
			}]);
		});
		for(var i = 0;i < aU.x.length;i++){
			aU.x[i] -= 1;
		}
		if(aU.x.length > 4){
		aU.x.shift();
		aU.y.shift();
		}
		aU.x.push(0);
		aU.y.push(tact);
		if(tU.x.length > 4){
			tU.x.shift();
			tU.y.shift();
		}
		tU.x.push(0);
		tU.y.push(total);
		users.setData([aU, tU]);
		screen.render();
	});

}
client.on("connect", function(){
setInterval(update, 1000);
update();
screen.render();
});
