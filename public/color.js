
var schemes = {
	"solarized":{
		"main-bg":"#073642",
		"sec-bg":"#002b36",
		"border":"#2aa198",
		"text":"#93a1a1",
		"follow":"#657b83"
	},
	"jackson":{
		"main-bg":"#D15000",
		"sec-bg":"#3F88C5",
		"border":"#C6CAD1",
		"text":"#AEB2B7",
		"follow":"#F7F5FA"
	}
}
if(localStorage.getItem("colorscheme")){
	changeColorscheme(localStorage.getItem("colorscheme"));
} else {
	changeColorscheme("solarized");
}
function changeColorscheme(scheme){
	if(!schemes[scheme]){
		scheme = "solarized";
	}
	Object.keys(schemes[scheme]).forEach(function(key){
		document.getElementsByTagName("html")[0].style.setProperty("--"+key, schemes[scheme][key]);
	});
}

