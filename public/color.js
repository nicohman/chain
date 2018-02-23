
var schemes = {
	"solarized":{
		"main-bg":"#073642",
		"sec-bg":"#002b36",
		"border":"#2aa198",
		"text":"#93a1a1",
		"follow":"#657b83"
	},
	"jackson":{
		"main-bg":"#C6CAD1",
		"sec-bg":"#D15000",
		"border":"#C6CAD1",
		"text":"#F7F5FA",
		"follow":"#3F88C5"
	},
	"monokai":{
		"main-bg":"#272822",
		"sec-bg":"#272822",
		"border":"#FD971F",
		"text":"#FFFFFF",
		"follow":"#66D9EF"

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

